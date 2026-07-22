"""
Tool Definitions — LLM Function Calling

The 5 core tools available to the voice agent:
1. get_current_running_order — Read current state
2. analyze_impact — Calculate cascading effects
3. propose_timeline_update — Create formal proposal
4. apply_timeline_update — Apply after confirmation only
5. push_anchor_instruction — Send instruction to anchor

See: knowledge-base/06-tools-and-function-calling.md
"""

from __future__ import annotations

import logging
import json
import uuid
from typing import Annotated, Optional
from datetime import datetime

from livekit.agents import llm

from agent.confirmation import ConfirmationGuard
from agent.session import SessionManager, supabase_client, redis_client

logger = logging.getLogger("sudriv-agent.tools")

# Must match DB: valid_instruction_type CHECK
VALID_INSTRUCTION_TYPES = frozenset(
    {"transition", "breaking", "correction", "timing", "general"}
)

# Map common LLM mistakes → allowed values
_INSTRUCTION_TYPE_ALIASES = {
    "segment": "general",
    "segments": "general",
    "update": "general",
    "insert": "transition",
    "remove": "transition",
    "reorder": "transition",
    "news": "breaking",
    "breaking_news": "breaking",
    "break": "breaking",
    "fix": "correction",
    "time": "timing",
    "delay": "timing",
    "cue": "transition",
    "intro": "transition",
    "outro": "transition",
    "other": "general",
    "info": "general",
    "instruction": "general",
}


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-")


def normalize_instruction_type(raw: str | None) -> str:
    """Coerce LLM-provided type into a DB-allowed value."""
    if not raw:
        return "transition"
    key = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    if key in VALID_INSTRUCTION_TYPES:
        return key
    mapped = _INSTRUCTION_TYPE_ALIASES.get(key)
    if mapped:
        logger.info("instruction_type %r → %r", raw, mapped)
        return mapped
    logger.warning("Unknown instruction_type %r — using 'general'", raw)
    return "general"


class SudrivToolkit:
    """Registers all tools available to the voice agent."""

    def __init__(self, session: SessionManager):
        self.session = session
        self.confirmation_guard = ConfirmationGuard(session)

    # ─── Tool 1: Read ─────────────────────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Get the current running order for the active session. "
            "Returns all segments with positions, durations, start times, and statuses. "
            "Call this before analyzing impact or proposing changes."
        )
    )
    async def get_current_running_order(self) -> str:
        """Fetch the current running order."""
        try:
            ro = self.session.running_order
            return self._format_running_order(ro)
        except Exception as e:
            logger.error(f"Failed to get running order: {e}")
            return "Error: Unable to fetch the running order. Please try again."

    def _format_running_order(self, ro: dict) -> str:
        """Compact running-order table for the conversation LLM (no teleprompter text)."""
        segments = sorted(ro.get("segments", []), key=lambda s: s["position"])
        total_mins = ro.get("total_duration_seconds", 0) // 60

        lines = [
            f"RO v{ro.get('version', 1)} | {len(segments)} segs | {total_mins} min total"
        ]
        for seg in segments:
            offset_mins, offset_secs = divmod(seg.get("start_offset_seconds", 0), 60)
            dur_mins, dur_secs = divmod(seg["duration_seconds"], 60)
            lines.append(
                f"{seg['position']}. {seg['title'][:50]} "
                f"@{offset_mins:02d}:{offset_secs:02d} "
                f"{dur_mins}m{dur_secs:02d}s "
                f"{seg.get('segment_type', 'package')}/"
                f"{seg.get('status', 'pending')}"
            )
        return "\n".join(lines)

    # ─── Tool 2: Analyze ──────────────────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Analyze the impact of a proposed change to the running order. "
            "Provide the action type and details, and this tool will calculate "
            "which segments are affected, how start times shift, and whether "
            "the show will run over its allocated duration. "
            "ALWAYS call this before proposing a timeline update."
        )
    )
    async def analyze_impact(
        self,
        action: Annotated[str, "The type of change: 'insert', 'remove', 'reorder', 'modify_duration', 'replace'"],
        target_position: Annotated[int, "The position (slot number) where the action applies"],
        new_segment_title: Annotated[Optional[str], "Title of the new segment (for insert/replace)"] = None,
        new_segment_duration_seconds: Annotated[Optional[int], "Duration in seconds (for insert/replace/modify_duration)"] = None,
        new_segment_type: Annotated[Optional[str], "Segment type (for insert/replace)"] = "package",
        news_item_id: Annotated[Optional[str], "ID of the news item to use (for insert/replace)"] = None,
        move_to_position: Annotated[Optional[int], "Target position (for reorder only)"] = None,
    ) -> str:
        """Analyze impact without modifying anything.

        Pure Python math (authoritative). The conversation LLM (gpt-4o-mini)
        turns this structured result into short speech — no second LLM call.
        """
        ro = self.session.running_order
        segments = sorted(ro.get("segments", []), key=lambda s: s["position"])

        try:
            impact = self._calculate_impact(
                segments=segments,
                action=action,
                target_position=target_position,
                new_title=new_segment_title,
                new_duration=new_segment_duration_seconds,
                new_type=new_segment_type,
                news_item_id=news_item_id,
                move_to=move_to_position,
                show_duration=ro.get("total_duration_seconds", 0),
            )
            return self._format_impact(impact)

        except ValueError as e:
            return f"Error in analysis: {str(e)}"

    def _calculate_impact(
        self,
        segments: list,
        action: str,
        target_position: int,
        new_title: str = None,
        new_duration: int = None,
        new_type: str = "package",
        news_item_id: str = None,
        move_to: int = None,
        show_duration: int = 0,
    ) -> dict:
        """
        Pure function that calculates impact without side effects.
        Returns a structured impact analysis.
        """
        
        affected = []
        new_segments = [s.copy() for s in segments]  # Deep copy
        
        if action == "insert":
            if not new_title or not new_duration:
                raise ValueError("Insert requires new_segment_title and new_segment_duration_seconds")
            
            new_segment = {
                "id": str(uuid.uuid4()),
                "position": target_position,
                "title": new_title,
                "slug": slugify(new_title),
                "segment_type": new_type,
                "duration_seconds": new_duration,
                "start_offset_seconds": 0,  # Will be recalculated
                "status": "pending",
                "news_item_id": news_item_id,
                # Anchor Script panel reads this field — never leave blank
                "teleprompter_text": (
                    f"{new_title}\n\n"
                    f"[LIVE]\n"
                    f"यह {new_title} सेगमेंट है। "
                    f"एंकर यहाँ से पढ़ना शुरू करें।"
                ),
            }
            
            # Shift all segments at and after target_position
            for seg in new_segments:
                if seg["position"] >= target_position:
                    old_pos = seg["position"]
                    seg["position"] = old_pos + 1
                    affected.append({
                        "segment_id": seg["id"],
                        "title": seg["title"],
                        "old_position": old_pos,
                        "new_position": seg["position"],
                    })
            
            new_segments.append(new_segment)
        
        elif action == "remove":
            removed = None
            for seg in new_segments:
                if seg["position"] == target_position:
                    removed = seg
                    break
            
            if not removed:
                raise ValueError(f"No segment found at position {target_position}")
            
            new_segments.remove(removed)
            
            # Shift segments after removed position
            for seg in new_segments:
                if seg["position"] > target_position:
                    old_pos = seg["position"]
                    seg["position"] = old_pos - 1
                    affected.append({
                        "segment_id": seg["id"],
                        "title": seg["title"],
                        "old_position": old_pos,
                        "new_position": seg["position"],
                    })
        
        elif action == "reorder":
            if move_to is None:
                raise ValueError("Reorder requires move_to_position")
            
            # Find the segment to move
            moving = None
            for seg in new_segments:
                if seg["position"] == target_position:
                    moving = seg
                    break
            
            if not moving:
                raise ValueError(f"No segment at position {target_position}")
            
            # Remove from old position, insert at new
            new_segments.remove(moving)
            
            # Recalculate positions
            for seg in sorted(new_segments, key=lambda s: s["position"]):
                if seg["position"] >= move_to:
                    seg["position"] += 1
            
            moving["position"] = move_to
            new_segments.append(moving)
            
            # Normalize positions to be contiguous
            new_segments.sort(key=lambda s: s["position"])
            for i, seg in enumerate(new_segments):
                if seg["position"] != i + 1:
                    affected.append({
                        "segment_id": seg["id"],
                        "title": seg["title"],
                        "old_position": seg["position"],
                        "new_position": i + 1,
                    })
                    seg["position"] = i + 1
        
        elif action == "modify_duration":
            if new_duration is None:
                raise ValueError("modify_duration requires new_segment_duration_seconds")
            
            for seg in new_segments:
                if seg["position"] == target_position:
                    old_duration = seg["duration_seconds"]
                    seg["duration_seconds"] = new_duration
                    affected.append({
                        "segment_id": seg["id"],
                        "title": seg["title"],
                        "old_duration": old_duration,
                        "new_duration": new_duration,
                    })
                    break
        
        # Recalculate start offsets
        new_segments.sort(key=lambda s: s["position"])
        for i, seg in enumerate(new_segments):
            if i == 0:
                seg["start_offset_seconds"] = 0
            else:
                prev = new_segments[i - 1]
                seg["start_offset_seconds"] = prev.get("start_offset_seconds", 0) + prev["duration_seconds"]
            
            # Track timing changes for affected segments
            original = next(
                (s for s in segments if s["id"] == seg["id"]), None
            )
            if original and original.get("start_offset_seconds", 0) != seg["start_offset_seconds"]:
                # Update affected entry or create new one
                existing = next((a for a in affected if a["segment_id"] == seg["id"]), None)
                if existing:
                    existing["old_start_offset"] = original.get("start_offset_seconds", 0)
                    existing["new_start_offset"] = seg["start_offset_seconds"]
                    existing["delay_seconds"] = seg["start_offset_seconds"] - original.get("start_offset_seconds", 0)
                else:
                    affected.append({
                        "segment_id": seg["id"],
                        "title": seg["title"],
                        "old_start_offset": original.get("start_offset_seconds", 0),
                        "new_start_offset": seg["start_offset_seconds"],
                        "delay_seconds": seg["start_offset_seconds"] - original.get("start_offset_seconds", 0),
                    })
        
        new_total = sum(s["duration_seconds"] for s in new_segments)
        old_total = sum(s["duration_seconds"] for s in segments)
        duration_change = new_total - old_total
        
        # Generate suggestions if show runs over
        suggestions = []
        if duration_change > 0:
            # Find segments that could be shortened or dropped
            for seg in reversed(new_segments):
                if seg.get("segment_type") not in ("headlines", "closing"):
                    suggestions.append(
                        f"Shorten '{seg['title']}' by {duration_change // 60} minutes"
                    )
                    suggestions.append(
                        f"Drop '{seg['title']}' ({seg['duration_seconds'] // 60} minutes)"
                    )
                    break
        
        return {
            "action": action,
            "affected_segments": affected,
            "new_segments": new_segments,
            "old_total_duration": old_total,
            "new_total_duration": new_total,
            "duration_change_seconds": duration_change,
            "suggestions": suggestions,
        }

    def _format_impact(self, impact: dict) -> str:
        """Format impact analysis for LLM consumption."""
        lines = ["Impact Analysis:"]
        lines.append(f"Action: {impact['action']}")
        lines.append(f"Duration change: {impact['duration_change_seconds']:+d} seconds")
        lines.append(
            f"New total: {impact['new_total_duration'] // 60} minutes "
            f"(was {impact['old_total_duration'] // 60} minutes)"
        )
        
        if impact["affected_segments"]:
            lines.append("\nAffected segments:")
            for seg in impact["affected_segments"]:
                parts = [f"  - {seg['title']}"]
                if "old_position" in seg and "new_position" in seg:
                    parts.append(f"moves from slot {seg['old_position']} to {seg['new_position']}")
                if "delay_seconds" in seg:
                    delay = seg["delay_seconds"]
                    if delay > 0:
                        parts.append(f"starts {delay // 60}m{delay % 60:02d}s later")
                    elif delay < 0:
                        parts.append(f"starts {abs(delay) // 60}m{abs(delay) % 60:02d}s earlier")
                parts_str = ", ".join(parts[1:])
                lines.append(f"{parts[0]}: {parts_str}" if parts_str else parts[0])
        
        if impact["duration_change_seconds"] > 0 and impact["suggestions"]:
            lines.append("\nSuggestions to stay within original duration:")
            for sug in impact["suggestions"]:
                lines.append(f"  • {sug}")
        
        return "\n".join(lines)

    # ─── Tool 3: Propose ──────────────────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Create a formal proposal for a running order change. "
            "This stores the proposal and prepares it for the producer's confirmation. "
            "ALWAYS call analyze_impact BEFORE this tool. "
            "After calling this tool, you MUST ask the producer for confirmation before applying."
        )
    )
    async def propose_timeline_update(
        self,
        action: Annotated[str, "The change type: 'insert', 'remove', 'reorder', 'modify_duration', 'replace'"],
        target_position: Annotated[int, "The position where the action applies"],
        summary: Annotated[str, "A concise human-readable summary of the proposed change"],
        impact_summary: Annotated[str, "A concise summary of the impact on other segments"],
        new_segment_title: Annotated[Optional[str], "Title of the new segment"] = None,
        new_segment_duration_seconds: Annotated[Optional[int], "Duration in seconds"] = None,
        new_segment_type: Annotated[Optional[str], "Segment type"] = "package",
        news_item_id: Annotated[Optional[str], "News item ID"] = None,
        move_to_position: Annotated[Optional[int], "Target position for reorder"] = None,
    ) -> str:
        """Create and store a proposal. Does NOT apply the change."""
        
        # Calculate the full impact (needed for the actual changes)
        segments = sorted(
            self.session.running_order.get("segments", []),
            key=lambda s: s["position"],
        )
        
        impact = self._calculate_impact(
            segments=segments,
            action=action,
            target_position=target_position,
            new_title=new_segment_title,
            new_duration=new_segment_duration_seconds,
            new_type=new_segment_type,
            news_item_id=news_item_id,
            move_to=move_to_position,
            show_duration=self.session.running_order.get("total_duration_seconds", 0),
        )
        
        proposal = {
            "proposal_type": action,
            "proposed_changes": {
                "action": action,
                "target_position": target_position,
                "new_segment_title": new_segment_title,
                "new_segment_duration_seconds": new_segment_duration_seconds,
                "new_segment_type": new_segment_type,
                "news_item_id": news_item_id,
                "move_to_position": move_to_position,
            },
            "impact_analysis": {
                "summary": impact_summary,
                "affected_segments": impact["affected_segments"],
                "duration_change_seconds": impact["duration_change_seconds"],
                "new_total_duration": impact["new_total_duration"],
                "suggestions": impact["suggestions"],
            },
            "new_segments": impact["new_segments"],
            "summary": summary,
        }
        
        proposal_id = await self.confirmation_guard.create_proposal(proposal)
        
        # Also persist to Supabase for audit
        try:
            supabase = supabase_client()
            supabase.table("proposals").insert({
                "id": proposal_id,
                "session_id": self.session.session_id,
                "proposal_type": action,
                "proposed_changes": proposal["proposed_changes"],
                "impact_analysis": proposal["impact_analysis"],
                "status": "pending",
            }).execute()
        except Exception as e:
            logger.error(f"Failed to persist proposal to Supabase: {e}")
        
        return (
            f"Proposal created (ID: {proposal_id[:8]}). "
            f"Summary: {summary}. "
            f"Impact: {impact_summary}. "
            f"IMPORTANT: Ask the producer for confirmation before applying."
        )

    # ─── Tool 4: Apply ────────────────────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Apply the previously proposed and CONFIRMED timeline update. "
            "This tool can ONLY be called after the producer has explicitly confirmed "
            "the pending proposal. If no proposal is confirmed, this will fail. "
            "NEVER call this without explicit producer confirmation."
        )
    )
    async def apply_timeline_update(
        self,
        producer_confirmation: Annotated[str, "The exact words the producer used to confirm (e.g., 'yes, apply it')"],
    ) -> str:
        """Apply the confirmed proposal to the running order."""
        
        # Safety check
        if not self.confirmation_guard.can_apply():
            return (
                "ERROR: Cannot apply — no confirmed proposal. "
                "You must first create a proposal with propose_timeline_update, "
                "then get explicit confirmation from the producer."
            )
        
        proposal = self.session.pending_proposal
        if not proposal:
            return "ERROR: No pending proposal found. Please create a new proposal."
        
        lock_key = f"session:{self.session.session_id}:lock"
        redis = redis_client()
        try:
            # Acquire Redis lock
            lock_acquired = await redis.set(
                lock_key, "agent", nx=True, ex=30
            )
            
            if not lock_acquired:
                return "ERROR: Another update is in progress. Please wait and try again."
            
            # Build new running order
            new_ro = {
                "session_id": self.session.session_id,
                "version": self.session.running_order.get("version", 0) + 1,
                "segments": proposal["new_segments"],
                "total_duration_seconds": sum(
                    s["duration_seconds"] for s in proposal["new_segments"]
                ),
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            # Validate invariants before applying
            validation_errors = self._validate_running_order(new_ro)
            if validation_errors:
                await redis.delete(lock_key)
                return f"ERROR: Invalid running order state: {'; '.join(validation_errors)}"
            
            # Apply to Redis + Supabase
            await self.session.update_running_order(new_ro)
            
            supabase = supabase_client()
            # If a news item was used, mark it
            news_item_id = proposal["proposed_changes"].get("news_item_id")
            if news_item_id:
                try:
                    supabase.table("news_items") \
                        .update({"is_used": True}) \
                        .eq("id", news_item_id) \
                        .execute()
                except Exception as e:
                    logger.error(f"Failed to update news item status: {e}")
            
            # Update proposal status in Supabase
            try:
                supabase.table("proposals") \
                    .update({
                        "status": "confirmed",
                        "producer_response": producer_confirmation,
                        "resolved_at": datetime.utcnow().isoformat(),
                    }) \
                    .eq("id", self.confirmation_guard.current_proposal_id) \
                    .execute()
            except Exception as e:
                logger.error(f"Failed to update proposal status in Supabase: {e}")
            
            # Log event
            try:
                supabase.table("session_events").insert({
                    "session_id": self.session.session_id,
                    "event_type": "running_order_updated",
                    "payload": {
                        "version": new_ro["version"],
                        "action": proposal["proposal_type"],
                        "summary": proposal["summary"],
                    },
                    "source": "agent",
                }).execute()
            except Exception as e:
                logger.error(f"Failed to log session event: {e}")
            
            # Mark applied in confirmation guard
            await self.confirmation_guard.mark_applied()
            
            # Release lock
            await redis.delete(lock_key)
            
            return (
                f"Timeline updated successfully (version {new_ro['version']}). "
                f"{len(new_ro['segments'])} segments, "
                f"total duration {new_ro['total_duration_seconds'] // 60} minutes. "
                f"Teleprompter and timeline are synced. "
                f"Now generate the anchor instruction using push_anchor_instruction."
            )
        
        except Exception as e:
            # Release lock on error
            await redis.delete(lock_key)
            logger.error(f"Failed to apply timeline update: {e}")
            return f"ERROR: Failed to apply update: {str(e)}. Running order is unchanged."

    def _validate_running_order(self, ro: dict) -> list[str]:
        """Validate running order invariants. Returns list of errors (empty = valid)."""
        errors = []
        segments = sorted(ro.get("segments", []), key=lambda s: s["position"])
        
        # Check contiguous positions
        for i, seg in enumerate(segments):
            if seg["position"] != i + 1:
                errors.append(
                    f"Position gap: expected {i + 1}, got {seg['position']} "
                    f"for '{seg['title']}'"
                )
        
        # Check offset calculation
        for i, seg in enumerate(segments):
            if i == 0:
                if seg.get("start_offset_seconds", 0) != 0:
                    errors.append(f"First segment offset should be 0, got {seg.get('start_offset_seconds', 0)}")
            else:
                expected = segments[i-1].get("start_offset_seconds", 0) + segments[i-1]["duration_seconds"]
                if seg.get("start_offset_seconds", 0) != expected:
                    errors.append(
                        f"Offset mismatch for '{seg['title']}': "
                        f"expected {expected}, got {seg.get('start_offset_seconds', 0)}"
                    )
        
        # Check positive durations
        for seg in segments:
            if seg["duration_seconds"] <= 0:
                errors.append(f"Invalid duration for '{seg['title']}': {seg['duration_seconds']}")
        
        # Check total duration
        calc_total = sum(s["duration_seconds"] for s in segments)
        if ro["total_duration_seconds"] != calc_total:
            errors.append(
                f"Total duration mismatch: stated {ro['total_duration_seconds']}, "
                f"calculated {calc_total}"
            )
        
        return errors

    # ─── Tool 5: Anchor Instruction ───────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Generate and push a clean instruction for the anchor. "
            "This should be called after a timeline update is applied. "
            "The instruction should be clear, concise, and actionable — "
            "the anchor is live on air and needs to know exactly what to do next. "
            "Do NOT include internal reasoning or impact analysis in the instruction."
        )
    )
    async def push_anchor_instruction(
        self,
        instruction_text: Annotated[
            str,
            "The clean instruction text for the anchor. Must be concise and actionable.",
        ],
        instruction_type: Annotated[
            str,
            "ONLY one of: transition | breaking | correction | timing | general. "
            "Never use values like 'segment' or 'update'.",
        ] = "transition",
        segment_id: Annotated[
            Optional[str],
            "The UUID of the related segment, if applicable. Must be a valid UUID string.",
        ] = None,
    ) -> str:
        """Generate and store an anchor instruction + update segment teleprompter if possible."""

        itype = normalize_instruction_type(instruction_type)

        # Validate segment_id is a UUID
        if segment_id:
            try:
                uuid.UUID(segment_id)
            except ValueError:
                logger.warning(
                    "Invalid UUID for segment_id: %s — clearing", segment_id
                )
                segment_id = None

        # If no segment_id, attach to first pending / first segment in local RO
        if not segment_id:
            segs = sorted(
                self.session.running_order.get("segments", []),
                key=lambda s: s.get("position", 0),
            )
            pick = next(
                (s for s in segs if s.get("status") in ("on_air", "pending")),
                segs[0] if segs else None,
            )
            if pick and pick.get("id"):
                try:
                    uuid.UUID(str(pick["id"]))
                    segment_id = str(pick["id"])
                except ValueError:
                    segment_id = None

        try:
            supabase = supabase_client()
            result = (
                supabase.table("anchor_instructions")
                .insert(
                    {
                        "session_id": self.session.session_id,
                        "segment_id": segment_id,
                        "instruction_text": instruction_text,
                        "instruction_type": itype,
                        "status": "pending",
                    }
                )
                .execute()
            )

            instruction_id = result.data[0]["id"] if result.data else "unknown"

            # Also push instruction text onto the segment teleprompter so
            # Anchor Script panel (which reads segments.teleprompter_text) updates.
            if segment_id and instruction_text:
                try:
                    # Prefer DB segment id from latest RO if local ids were regenerated
                    ro = (
                        supabase.table("running_orders")
                        .select("id")
                        .eq("session_id", self.session.session_id)
                        .order("version", desc=True)
                        .limit(1)
                        .execute()
                    )
                    if ro.data:
                        ro_id = ro.data[0]["id"]
                        # Match by title from local segment if id not in DB
                        segs_db = (
                            supabase.table("segments")
                            .select("id, title, position, teleprompter_text")
                            .eq("running_order_id", ro_id)
                            .order("position")
                            .execute()
                        )
                        target = None
                        for s in segs_db.data or []:
                            if s["id"] == segment_id:
                                target = s
                                break
                        if not target and segs_db.data:
                            # Fall back: first pending / first row
                            target = segs_db.data[0]

                        if target:
                            prev = (target.get("teleprompter_text") or "").strip()
                            cue = f"\n\n[ANCHOR CUE]\n{instruction_text}"
                            new_text = (
                                f"{prev}{cue}" if prev else f"{target.get('title', '')}{cue}"
                            )
                            supabase.table("segments").update(
                                {"teleprompter_text": new_text}
                            ).eq("id", target["id"]).execute()

                            # Keep in-memory RO in sync for subsequent tool calls
                            for s in self.session.running_order.get("segments", []):
                                if s.get("position") == target.get("position") or s.get(
                                    "title"
                                ) == target.get("title"):
                                    s["teleprompter_text"] = new_text
                                    break
                except Exception as te:
                    logger.warning("Could not update segment teleprompter: %s", te)

            try:
                supabase.table("session_events").insert(
                    {
                        "session_id": self.session.session_id,
                        "event_type": "anchor_instruction_sent",
                        "payload": {
                            "instruction_id": instruction_id,
                            "instruction_type": itype,
                            "instruction_text": instruction_text,
                        },
                        "source": "agent",
                    }
                ).execute()
            except Exception as ee:
                logger.warning("session_events insert skipped: %s", ee)

            return (
                f"Anchor instruction delivered ({itype}): \"{instruction_text}\". "
                f"Teleprompter/script panel will refresh."
            )

        except Exception as e:
            logger.error("Failed to push anchor instruction: %s", e)
            return f"ERROR: Failed to deliver anchor instruction: {str(e)}"
