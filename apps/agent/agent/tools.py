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


def speak_duration(seconds: int) -> str:
    """Human duration for LLM speech (never '3m0s')."""
    sec = int(seconds or 0)
    sign = "कम " if sec < 0 else ""
    sec = abs(sec)
    mins, rem = divmod(sec, 60)
    if mins == 0:
        return f"{sign}{rem} सेकंड"
    if rem == 0:
        if mins == 1:
            return f"{sign}1 मिनट"
        return f"{sign}{mins} मिनट"
    return f"{sign}{mins} मिनट {rem} सेकंड"


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
        """Compact running-order for the LLM (natural durations, no teleprompter)."""
        segments = sorted(ro.get("segments", []), key=lambda s: s["position"])
        total = ro.get("total_duration_seconds", 0)

        lines = [
            f"RO v{ro.get('version', 1)} | total {speak_duration(total)}"
        ]
        for seg in segments:
            start = int(seg.get("start_offset_seconds", 0) or 0)
            lines.append(
                f"स्लॉट {seg['position']}: {str(seg['title'])[:50]} "
                f"— {speak_duration(seg['duration_seconds'])}, "
                f"शुरुआत ~{speak_duration(start)} पर, "
                f"{seg.get('segment_type', 'package')}/{seg.get('status', 'pending')}"
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
        
        # Map common hallucinations
        if action in ("add", "append"):
            action = "insert"
            
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
        else:
            raise ValueError(f"Unknown action: {action}. Use 'insert', 'remove', 'reorder', or 'modify_duration'")
        
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
        """Format impact for LLM — natural Hindi-friendly durations (no 3m0s)."""
        delta = impact["duration_change_seconds"]
        lines = [
            f"क्रिया: {impact['action']}",
            f"अवधि बदलाव: {speak_duration(delta)}"
            + (" बढ़ेगी" if delta > 0 else " बचेगी" if delta < 0 else " (कोई बदलाव नहीं)"),
            f"नया कुल: {speak_duration(impact['new_total_duration'])} "
            f"(पहले {speak_duration(impact['old_total_duration'])})",
        ]

        if impact["affected_segments"]:
            lines.append("असर:")
            for seg in impact["affected_segments"][:5]:
                bits = [str(seg.get("title", "?"))]
                if "old_position" in seg and "new_position" in seg:
                    bits.append(
                        f"स्लॉट {seg['old_position']} → {seg['new_position']}"
                    )
                if "delay_seconds" in seg and seg["delay_seconds"]:
                    d = seg["delay_seconds"]
                    if d > 0:
                        bits.append(f"{speak_duration(d)} देर से")
                    else:
                        bits.append(f"{speak_duration(d)} पहले")
                lines.append("  - " + ", ".join(bits))

        lines.append(
            "बोलते समय: मिनट/सेकंड साधारण हिंदी में; "
            "एक बार पुष्टि माँगें; हाँ मिलते ही apply करें — दोबारा न पूछें।"
        )
        return "\n".join(lines)

    # ─── Tool 3: Propose ──────────────────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Store a pending running-order change. Call analyze_impact first. "
            "Then tell the producer ONCE in short Hindi what you will do + impact, "
            "and ask once 'कर दूँ?'. On their next haan/confirm, call apply_timeline_update "
            "immediately — do not propose again or re-ask."
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
            f"Proposal ready (id {proposal_id[:8]}). "
            f"Summary: {summary}. Impact: {impact_summary}. "
            f"SPEAK once in short Hindi + ask once 'कर दूँ?'. "
            f"On haan/confirm/ठीक/कर दो → call apply_timeline_update immediately. "
            f"Do NOT ask confirmation twice."
        )

    # ─── Tool 4: Apply ────────────────────────────────────────────────────────

    @llm.function_tool(
        description=(
            "Apply the pending proposal AFTER the producer said yes once "
            "(haan, हाँ, ठीक, कर दो, apply, confirm, ok). "
            "Call this immediately on that turn — never re-ask. "
            "Also updates Anchor Script / teleprompter automatically."
        )
    )
    async def apply_timeline_update(
        self,
        producer_confirmation: Annotated[
            str,
            "Producer's confirm words, e.g. 'haan', 'kar do', 'confirm', 'ठीक है'",
        ],
    ) -> str:
        """Apply the confirmed proposal to the running order + anchor script."""
        
        # Safety check
        if not self.confirmation_guard.can_apply():
            return (
                "ERROR: No pending proposal to apply. "
                "First propose_timeline_update, then apply only after producer says yes."
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

            # Auto-update Anchor Script / teleprompter (do not wait for a 2nd tool call)
            anchor_note = await self._auto_anchor_after_apply(proposal)

            # Release lock
            await redis.delete(lock_key)

            total_spoken = speak_duration(new_ro["total_duration_seconds"])
            return (
                f"APPLIED v{new_ro['version']}. Total now {total_spoken}. {anchor_note} "
                f"Reply in one short friendly Hindi line: done + what changed "
                f"(anchor script updated). No second confirm, no full list."
            )
        
        except Exception as e:
            # Release lock on error
            await redis.delete(lock_key)
            logger.error(f"Failed to apply timeline update: {e}")
            return f"ERROR: Failed to apply update: {str(e)}. Running order is unchanged."

    async def _auto_anchor_after_apply(self, proposal: dict) -> str:
        """Push a short anchor cue + teleprompter after timeline apply."""
        try:
            action = proposal.get("proposal_type") or proposal.get("proposed_changes", {}).get(
                "action", "update"
            )
            summary = (proposal.get("summary") or action).strip()
            changes = proposal.get("proposed_changes") or {}
            title = changes.get("new_segment_title") or ""
            pos = changes.get("target_position") or changes.get("move_to_position")

            # Concise Hindi cue for the anchor panel / teleprompter
            if action == "insert" and title:
                cue = f"अगला: स्लॉट {pos} पर '{title}' जोड़ दिया गया है। उसी क्रम से आगे बढ़ें।"
                itype = "breaking" if "break" in summary.lower() else "transition"
            elif action == "remove":
                cue = f"स्लॉट {pos} हटाया गया। रनिंग ऑर्डर अपडेट — अगले आइटम पर जाएँ।"
                itype = "transition"
            elif action == "reorder":
                cue = f"क्रम बदला: स्लॉट {changes.get('target_position')} → {changes.get('move_to_position')}। नए क्रम से पढ़ें।"
                itype = "transition"
            elif action == "modify_duration":
                cue = f"स्लॉट {pos} की अवधि बदली। टाइमिंग ध्यान रखें।"
                itype = "timing"
            else:
                cue = f"रनिंग ऑर्डर अपडेट: {summary[:120]}"
                itype = "general"

            result = await self._deliver_anchor_instruction(
                instruction_text=cue,
                instruction_type=itype,
                segment_id=None,
                preferred_position=int(pos) if pos else None,
            )
            return result
        except Exception as e:
            logger.warning("Auto anchor after apply failed: %s", e)
            return "Anchor script auto-update failed — you may call push_anchor_instruction."

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
            "Optional: push an extra anchor cue. "
            "Usually NOT needed after apply_timeline_update (auto-updates script). "
            "Use only if producer asks for a different anchor message."
        )
    )
    async def push_anchor_instruction(
        self,
        instruction_text: Annotated[
            str,
            "Short actionable Hindi/English cue for the anchor (1–2 lines).",
        ],
        instruction_type: Annotated[
            str,
            "ONLY one of: transition | breaking | correction | timing | general.",
        ] = "transition",
        segment_id: Annotated[
            Optional[str],
            "Related segment UUID if known.",
        ] = None,
    ) -> str:
        """Store anchor instruction + update teleprompter / Anchor Script panel."""
        return await self._deliver_anchor_instruction(
            instruction_text=instruction_text,
            instruction_type=instruction_type,
            segment_id=segment_id,
            preferred_position=None,
        )

    async def _deliver_anchor_instruction(
        self,
        *,
        instruction_text: str,
        instruction_type: str = "transition",
        segment_id: Optional[str] = None,
        preferred_position: Optional[int] = None,
    ) -> str:
        """Shared path: DB anchor_instructions + segment teleprompter + Redis cache."""
        import asyncio

        itype = normalize_instruction_type(instruction_type)
        text = (instruction_text or "").strip()
        if not text:
            return "ERROR: empty anchor instruction"

        if segment_id:
            try:
                uuid.UUID(segment_id)
            except ValueError:
                logger.warning("Invalid segment_id %s — clearing", segment_id)
                segment_id = None

        segs_local = sorted(
            self.session.running_order.get("segments", []),
            key=lambda s: s.get("position", 0),
        )

        if not segment_id and preferred_position is not None:
            pick = next(
                (s for s in segs_local if int(s.get("position", 0)) == preferred_position),
                None,
            )
            if pick and pick.get("id"):
                try:
                    uuid.UUID(str(pick["id"]))
                    segment_id = str(pick["id"])
                except ValueError:
                    segment_id = None

        if not segment_id:
            pick = next(
                (s for s in segs_local if s.get("status") in ("on_air", "pending")),
                segs_local[0] if segs_local else None,
            )
            if pick and pick.get("id"):
                try:
                    uuid.UUID(str(pick["id"]))
                    segment_id = str(pick["id"])
                except ValueError:
                    segment_id = None

        session_id = self.session.session_id

        def _write() -> tuple[str, Optional[str], Optional[int]]:
            supabase = supabase_client()
            result = (
                supabase.table("anchor_instructions")
                .insert(
                    {
                        "session_id": session_id,
                        "segment_id": segment_id,
                        "instruction_text": text,
                        "instruction_type": itype,
                        "status": "pending",
                    }
                )
                .execute()
            )
            instruction_id = result.data[0]["id"] if result.data else "unknown"
            new_text: Optional[str] = None
            target_pos: Optional[int] = preferred_position

            ro = (
                supabase.table("running_orders")
                .select("id")
                .eq("session_id", session_id)
                .order("version", desc=True)
                .limit(1)
                .execute()
            )
            if ro.data:
                ro_id = ro.data[0]["id"]
                segs_db = (
                    supabase.table("segments")
                    .select("id, title, position, teleprompter_text")
                    .eq("running_order_id", ro_id)
                    .order("position")
                    .execute()
                )
                target = None
                rows = segs_db.data or []
                if preferred_position is not None:
                    target = next(
                        (s for s in rows if s.get("position") == preferred_position),
                        None,
                    )
                if not target and segment_id:
                    target = next((s for s in rows if s["id"] == segment_id), None)
                if not target and rows:
                    target = rows[0]

                if target:
                    prev = (target.get("teleprompter_text") or "").strip()
                    # Replace previous auto cue block to avoid stacking
                    if "[ANCHOR CUE]" in prev:
                        prev = prev.split("[ANCHOR CUE]")[0].rstrip()
                    cue = f"\n\n[ANCHOR CUE]\n{text}"
                    new_text = f"{prev}{cue}" if prev else f"{target.get('title', '')}{cue}"
                    supabase.table("segments").update(
                        {"teleprompter_text": new_text}
                    ).eq("id", target["id"]).execute()
                    target_pos = target.get("position")

            try:
                supabase.table("session_events").insert(
                    {
                        "session_id": session_id,
                        "event_type": "anchor_instruction_sent",
                        "payload": {
                            "instruction_id": instruction_id,
                            "instruction_type": itype,
                            "instruction_text": text,
                        },
                        "source": "agent",
                    }
                ).execute()
            except Exception as ee:
                logger.warning("session_events insert skipped: %s", ee)

            return instruction_id, new_text, target_pos

        try:
            _iid, new_text, target_pos = await asyncio.to_thread(_write)

            if new_text is not None:
                for s in self.session.running_order.get("segments", []):
                    if target_pos is not None and s.get("position") == target_pos:
                        s["teleprompter_text"] = new_text
                        break
                # Keep Redis RO in sync so Anchor Script UI polls fresh text
                try:
                    redis = redis_client()
                    await redis.set(
                        f"running_order:{session_id}",
                        json.dumps(self.session.running_order),
                    )
                except Exception as re:
                    logger.warning("Redis teleprompter sync failed: %s", re)

            return f"Anchor script updated ({itype}): \"{text}\""
        except Exception as e:
            logger.error("Failed to push anchor instruction: %s", e)
            return f"ERROR: Failed to deliver anchor instruction: {str(e)}"
