"""
Session Manager

Manages per-session state: running order cache, news items, and conversation context.

See: knowledge-base/05-voice-agent-design.md (Session Manager)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

from redis.asyncio import Redis
from supabase import Client, create_client

logger = logging.getLogger("sudriv-agent.session")

# Loop-bound Redis: LiveKit reuses job processes with a new event loop per job.
# A process-global redis.asyncio client causes:
#   RuntimeError: got Future attached to a different loop
_redis_instance: Optional[Redis] = None
_redis_loop: Optional[asyncio.AbstractEventLoop] = None
_supabase_instance: Optional[Client] = None


def redis_client() -> Redis:
    global _redis_instance, _redis_loop
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError as e:
        raise RuntimeError(
            "redis_client() requires a running event loop"
        ) from e

    if _redis_instance is not None and _redis_loop is loop and not loop.is_closed():
        return _redis_instance

    if _redis_instance is not None:
        try:
            _redis_instance.connection_pool.disconnect(inuse_connections=True)
        except Exception:
            pass
        _redis_instance = None
        _redis_loop = None

    url = os.environ.get("UPSTASH_REDIS_URL")
    if not url:
        raise RuntimeError("UPSTASH_REDIS_URL is required")

    _redis_instance = Redis.from_url(url, decode_responses=True)
    _redis_loop = loop
    return _redis_instance


async def close_redis() -> None:
    """Close loop-bound Redis client (job shutdown)."""
    global _redis_instance, _redis_loop
    client = _redis_instance
    _redis_instance = None
    _redis_loop = None
    if client is None:
        return
    try:
        await client.aclose()
    except Exception as e:
        logger.debug("redis aclose: %s", e)


def supabase_client() -> Client:
    global _supabase_instance
    if _supabase_instance is None:
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = (
            os.environ.get("SUPABASE_SERVICE_KEY")
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) required"
            )
        _supabase_instance = create_client(url, key)
    return _supabase_instance


@dataclass
class SessionManager:
    """Per-session state manager. One instance per LiveKit room."""

    session_id: str
    user_id: str
    running_order: dict[str, Any]
    available_news_items: list[dict[str, Any]]
    pending_proposal: Optional[dict[str, Any]] = None
    _conversation_context: dict[str, Any] = field(default_factory=dict)

    # Clients — initialized lazily or via from_room()
    # redis_client: Any = None
    # supabase_client: Any = None

    @classmethod
    async def from_room(cls, room: Any) -> "SessionManager":
        """
        Initialize session from LiveKit room metadata or room name.

        The room name is `sudriv-{sessionId}`, set by the token endpoint.
        Room metadata may also contain session_id if set.
        """
        metadata = json.loads(room.metadata or "{}")
        session_id = metadata.get("session_id")
        
        # Fallback: extract session_id from room name (format: "sudriv-{uuid}")
        if not session_id and room.name and room.name.startswith("sudriv-"):
            session_id = room.name[len("sudriv-"):]
        
        if not session_id:
            session_id = "demo-session"

        user_id = metadata.get("user_id", "unknown")

        logger.info(f"Initializing session {session_id} from room {room.name}")

        redis = redis_client()
        supabase = supabase_client()

        running_order = None
        
        # 1. Try to load from Redis
        try:
            ro_json = await redis.get(f"running_order:{session_id}")
            if ro_json:
                running_order = json.loads(ro_json)
        except Exception as e:
            logger.warning(f"Failed to load running order from Redis: {e}")

        # 2. If not in Redis, load from Supabase
        if not running_order:
            logger.info(f"Running order not in Redis for {session_id}, loading from Supabase")
            # Get the running order ID for this session
            ro_resp = supabase.table("running_orders").select("*").eq("session_id", session_id).order("version", desc=True).limit(1).execute()
            
            if ro_resp.data:
                ro_data = ro_resp.data[0]
                
                # Fetch segments for this running order
                seg_resp = supabase.table("segments").select("*").eq("running_order_id", ro_data["id"]).order("position").execute()
                
                running_order = {
                    "session_id": session_id,
                    "version": ro_data["version"],
                    "total_duration_seconds": ro_data["total_duration_seconds"],
                    "segments": seg_resp.data if seg_resp.data else []
                }
                
                # Cache it in Redis asynchronously (fire and forget)
                import asyncio
                asyncio.create_task(redis.set(f"running_order:{session_id}", json.dumps(running_order)))
            else:
                # No running order found
                running_order = {
                    "session_id": session_id,
                    "version": 1,
                    "total_duration_seconds": 0,
                    "segments": [],
                }

        # 3. Load available news items from Supabase
        news_items = []
        try:
            news_resp = supabase.table("news_items").select("*").eq("is_used", False).execute()
            if news_resp.data:
                news_items = news_resp.data
        except Exception as e:
            logger.warning(f"Failed to load news items from Supabase: {e}")

        return cls(
            session_id=session_id,
            user_id=user_id,
            running_order=running_order,
            available_news_items=news_items,
        )

    def get_focus_context(self) -> str:
        """
        Aggressive context window for the system prompt.

        Sends only:
          - show totals
          - current (on_air) segment OR first pending
          - next few upcoming slots
          - top 2–3 relevant news headlines

        Full RO / full news list → tools only.
        """
        segments = sorted(
            self.running_order.get("segments", []),
            key=lambda s: s.get("position", 0),
        )
        total_mins = self.running_order.get("total_duration_seconds", 0) // 60
        version = self.running_order.get("version", 1)
        n = len(segments)

        if not segments:
            ro_block = "Running order: empty (not loaded yet)."
        else:
            # Prefer on-air segment as "current"; else first pending; else slot 1.
            current = next(
                (s for s in segments if s.get("status") == "on_air"),
                None,
            )
            if current is None:
                current = next(
                    (s for s in segments if s.get("status") in ("pending", "ready", None)),
                    segments[0],
                )

            cur_pos = int(current.get("position", 1))
            upcoming = [
                s
                for s in segments
                if int(s.get("position", 0)) > cur_pos
            ][:3]

            def _slot_line(s: dict, label: str) -> str:
                offset = int(s.get("start_offset_seconds", 0) or 0)
                mm, ss = divmod(offset, 60)
                dur = int(s.get("duration_seconds", 0) or 0)
                dmm, dss = divmod(dur, 60)
                title = str(s.get("title", "?"))[:48]
                status = s.get("status", "pending")
                return (
                    f"  {label} slot {s.get('position')}: {title} "
                    f"@{mm:02d}:{ss:02d} ({dmm}m{dss:02d}s, {status})"
                )

            lines = [
                f"Running order v{version}: {n} segments, {total_mins} min total.",
                _slot_line(current, "NOW"),
            ]
            for i, s in enumerate(upcoming):
                lines.append(_slot_line(s, f"NEXT{i + 1}"))
            remaining = n - 1 - len(upcoming)
            if remaining > 0:
                lines.append(f"  …+{remaining} more slots (use get_current_running_order).")
            ro_block = "\n".join(lines)

        news = self.available_news_items or []
        if not news:
            news_block = "News desk: no unused items loaded."
        else:
            priority_rank = {"breaking": 0, "high": 1, "medium": 2, "low": 3}
            ranked = sorted(
                news,
                key=lambda i: priority_rank.get(
                    str(i.get("priority", "medium")).lower(), 9
                ),
            )
            tops = ranked[:3]
            news_lines = [
                f"  [{i.get('priority', 'medium')}] {str(i.get('headline', ''))[:56]}"
                for i in tops
            ]
            more = len(news) - len(tops)
            tail = f"\n  …+{more} more items available via tools" if more > 0 else ""
            news_block = (
                f"News desk: {len(news)} unused items. Top:\n"
                + "\n".join(news_lines)
                + tail
            )

        pending = self.pending_proposal
        if pending:
            prop = (
                f"Pending proposal: {pending.get('summary', pending.get('proposal_type', 'change'))} "
                f"— waiting for producer confirmation."
            )
        else:
            prop = "Pending proposal: none."

        return f"{ro_block}\n{news_block}\n{prop}"

    def get_compact_session_snapshot(self) -> str:
        """Back-compat one-liner; prefer get_focus_context() for prompts."""
        return self.get_focus_context().replace("\n", " | ")

    def get_running_order_summary(self, *, compact: bool = False) -> str:
        """Summary of the running order (compact for analysis, fuller for tools)."""
        segments = self.running_order.get("segments", [])
        if not segments:
            return "No segments loaded."

        total_mins = self.running_order.get("total_duration_seconds", 0) // 60
        if compact:
            titles = ", ".join(
                f"{s.get('position')}:{s.get('title', '?')[:32]}"
                for s in sorted(segments, key=lambda x: x.get("position", 0))[:10]
            )
            return f"{len(segments)} segs, {total_mins} min — {titles}"

        lines = []
        for seg in sorted(segments, key=lambda s: s["position"]):
            offset = seg.get("start_offset_seconds", 0)
            mins, secs = divmod(offset, 60)
            duration_mins = seg.get("duration_seconds", 0) // 60
            lines.append(
                f"  {seg['position']}. [{mins:02d}:{secs:02d}] "
                f"{seg['title']} ({duration_mins}min) - {seg.get('status', 'pending')}"
            )

        return f"Total: {total_mins} minutes, {len(segments)} segments\n" + "\n".join(lines)

    def get_news_items_summary(self, *, limit: int = 5) -> str:
        """Short news list for tools — never dump the full catalog into the system prompt."""
        if not self.available_news_items:
            return "No news items loaded."

        priority_rank = {"breaking": 0, "high": 1, "medium": 2, "low": 3}
        ranked = sorted(
            self.available_news_items,
            key=lambda i: priority_rank.get(str(i.get("priority", "medium")).lower(), 9),
        )
        lines = []
        for item in ranked[:limit]:
            lines.append(
                f"  - [{item.get('priority', 'medium').upper()}] {item['headline']} "
                f"({item.get('category', 'general')}, "
                f"~{item.get('estimated_duration_seconds', 180) // 60}min)"
            )
        more = len(self.available_news_items) - limit
        footer = f"\n  …and {more} more (ask to list more if needed)" if more > 0 else ""
        return (
            f"{len(self.available_news_items)} items available (showing top {min(limit, len(ranked))}):\n"
            + "\n".join(lines)
            + footer
        )

    def build_greeting(self) -> str:
        """Short friendly Hindi opener — no segment dumps."""
        return "नमस्ते! मैं सुद्रिव हूँ, तैयार हूँ। बताइए, क्या करना है?"

    async def update_running_order(self, new_order: dict[str, Any]) -> None:
        """
        Update running order in Redis + Supabase.

        Awaits DB write so the frontend poll/Refresh sees new segments immediately
        after the tool returns (not fire-and-forget).
        """
        import asyncio

        self.running_order = new_order
        version = new_order.get("version", 1)
        total_dur = new_order.get("total_duration_seconds", 0)
        logger.info("Running order → v%s (%d segs)", version, len(new_order.get("segments", [])))

        try:
            redis = redis_client()
            await redis.set(f"running_order:{self.session_id}", json.dumps(new_order))
        except Exception as e:
            logger.error("Failed to update running order in Redis: %s", e)

        def _update_db() -> int:
            supabase = supabase_client()
            # Latest RO for this session
            ro_result = (
                supabase.table("running_orders")
                .select("id, version")
                .eq("session_id", self.session_id)
                .order("version", desc=True)
                .limit(1)
                .execute()
            )
            if not ro_result.data:
                raise RuntimeError(f"No running_orders row for session {self.session_id}")

            ro_id = ro_result.data[0]["id"]
            supabase.table("running_orders").update(
                {"version": version, "total_duration_seconds": total_dur}
            ).eq("id", ro_id).execute()

            supabase.table("segments").delete().eq("running_order_id", ro_id).execute()

            segments = new_order.get("segments", [])
            if segments:
                inserts = []
                for seg in segments:
                    row = {
                        "running_order_id": ro_id,
                        "position": seg["position"],
                        "title": seg["title"],
                        "slug": seg.get("slug", f"seg-{seg['position']}"),
                        "segment_type": seg.get("segment_type", "package"),
                        "duration_seconds": seg["duration_seconds"],
                        "start_offset_seconds": seg.get("start_offset_seconds", 0),
                        "teleprompter_text": seg.get("teleprompter_text")
                        or f"{seg['title']}\n\n(स्क्रिप्ट उपलब्ध नहीं।)",
                        "status": seg.get("status", "pending"),
                    }
                    nid = seg.get("news_item_id")
                    if nid:
                        row["news_item_id"] = nid
                    inserts.append(row)
                supabase.table("segments").insert(inserts).execute()

            return len(segments)

        try:
            n = await asyncio.to_thread(_update_db)
            logger.info("Supabase RO synced v%s segs=%d session=%s", version, n, self.session_id)
        except Exception as e:
            logger.error("Failed to update running order in Supabase: %s", e)

    async def set_pending_proposal(self, proposal: dict[str, Any]) -> None:
        """Store the current pending proposal."""
        self.pending_proposal = proposal
        try:
            redis = redis_client()
            await redis.setex(f"proposal:{self.session_id}", 300, json.dumps(proposal))
        except Exception as e:
            logger.error(f"Failed to set proposal in Redis: {e}")

    async def clear_pending_proposal(self) -> None:
        """Clear the pending proposal."""
        self.pending_proposal = None
        try:
            redis = redis_client()
            await redis.delete(f"proposal:{self.session_id}")
        except Exception as e:
            logger.error(f"Failed to clear proposal in Redis: {e}")

    async def sync_context_to_redis(self, chat_ctx: Any) -> None:
        """Sync the conversational chat context to Redis."""
        try:
            redis = redis_client()
            
            # Serialize chat context
            messages = []
            for msg in chat_ctx.messages():
                # Basic serialization of role and content
                messages.append({
                    "role": msg.role,
                    "content": str(msg.content) if not isinstance(msg.content, str) else msg.content
                })
                
            await redis.set(f"chat_context:{self.session_id}", json.dumps(messages))
        except Exception as e:
            logger.error(f"Failed to sync chat context to Redis: {e}")
