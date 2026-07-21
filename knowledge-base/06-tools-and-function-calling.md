# 06 — Tools & Function Calling

## Overview

The Voice Agent interacts with the running order and newsroom systems through **LLM function calling** (tool use). The LLM decides when to call a tool based on the conversation context, and the tool executor handles the actual data operations.

All tools follow the strict workflow: **Read → Analyze → Propose → Confirm → Apply**.

---

## Tool Definitions

### Tool 1: `get_current_running_order`

**Purpose**: Read the current state of the running order.  
**When to call**: Before any analysis, when the producer asks about the current timeline, or when the agent needs fresh state.  
**Side effects**: None (read-only).

```python
@llm.ai_callable(
    description=(
        "Get the current running order for the active session. "
        "Returns all segments with positions, durations, start times, and statuses. "
        "Call this before analyzing impact or proposing changes to ensure you have the latest state."
    )
)
async def get_current_running_order(self) -> str:
    """Fetch the current running order from Redis cache."""
    try:
        ro = await self.session.redis_client.get(
            f"session:{self.session.session_id}:running_order"
        )
        if not ro:
            # Cache miss — reload from Supabase
            ro = await self.session._load_running_order(
                self.session.redis_client,
                self.session.supabase_client,
                self.session.session_id,
            )
        else:
            ro = json.loads(ro)
        
        # Update local state
        self.session.running_order = ro
        
        # Return formatted summary for the LLM
        return self._format_running_order(ro)
    
    except Exception as e:
        logger.error(f"Failed to get running order: {e}")
        return "Error: Unable to fetch the running order. Please try again."


def _format_running_order(self, ro: dict) -> str:
    """Format running order for LLM consumption."""
    segments = sorted(ro.get("segments", []), key=lambda s: s["position"])
    total_mins = ro.get("total_duration_seconds", 0) // 60
    
    lines = [f"Running Order (Version {ro.get('version', 1)}, Total: {total_mins} minutes):"]
    lines.append("=" * 60)
    
    for seg in segments:
        offset_mins, offset_secs = divmod(seg["start_offset_seconds"], 60)
        dur_mins, dur_secs = divmod(seg["duration_seconds"], 60)
        status_icon = {
            "pending": "⏳",
            "on_air": "🔴",
            "completed": "✅",
            "skipped": "⏭️",
        }.get(seg["status"], "❓")
        
        lines.append(
            f"{status_icon} Slot {seg['position']}: {seg['title']} "
            f"| Start: {offset_mins:02d}:{offset_secs:02d} "
            f"| Duration: {dur_mins}m{dur_secs:02d}s "
            f"| Type: {seg['segment_type']} "
            f"| Status: {seg['status']}"
        )
    
    lines.append("=" * 60)
    return "\n".join(lines)
```

---

### Tool 2: `analyze_impact`

**Purpose**: Calculate the cascading effect of a proposed change on the running order.  
**When to call**: When the producer asks to add, remove, move, or resize a segment.  
**Side effects**: None (read-only analysis).

```python
@llm.ai_callable(
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
    """Analyze impact without modifying anything."""
    
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
            "teleprompter_text": "",
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
            seg["start_offset_seconds"] = prev["start_offset_seconds"] + prev["duration_seconds"]
        
        # Track timing changes for affected segments
        original = next(
            (s for s in segments if s["id"] == seg["id"]), None
        )
        if original and original["start_offset_seconds"] != seg["start_offset_seconds"]:
            # Update affected entry or create new one
            existing = next((a for a in affected if a["segment_id"] == seg["id"]), None)
            if existing:
                existing["old_start_offset"] = original["start_offset_seconds"]
                existing["new_start_offset"] = seg["start_offset_seconds"]
                existing["delay_seconds"] = seg["start_offset_seconds"] - original["start_offset_seconds"]
            else:
                affected.append({
                    "segment_id": seg["id"],
                    "title": seg["title"],
                    "old_start_offset": original["start_offset_seconds"],
                    "new_start_offset": seg["start_offset_seconds"],
                    "delay_seconds": seg["start_offset_seconds"] - original["start_offset_seconds"],
                })
    
    new_total = sum(s["duration_seconds"] for s in new_segments)
    old_total = sum(s["duration_seconds"] for s in segments)
    duration_change = new_total - old_total
    
    # Generate suggestions if show runs over
    suggestions = []
    if duration_change > 0:
        # Find segments that could be shortened or dropped
        for seg in reversed(new_segments):
            if seg["segment_type"] not in ("headlines", "closing"):
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
```

---

### Tool 3: `propose_timeline_update`

**Purpose**: Create a formal proposal for a running order change.  
**When to call**: After `analyze_impact` has been called and the impact is understood.  
**Side effects**: Stores the proposal in Redis with a 5-minute TTL.

```python
@llm.ai_callable(
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
    await self.session.supabase_client.table("proposals").insert({
        "id": proposal_id,
        "session_id": self.session.session_id,
        "proposal_type": action,
        "proposed_changes": proposal["proposed_changes"],
        "impact_analysis": proposal["impact_analysis"],
        "status": "pending",
    }).execute()
    
    return (
        f"Proposal created (ID: {proposal_id[:8]}). "
        f"Summary: {summary}. "
        f"Impact: {impact_summary}. "
        f"IMPORTANT: Ask the producer for confirmation before applying."
    )
```

---

### Tool 4: `apply_timeline_update`

**Purpose**: Apply a confirmed proposal to the running order.  
**When to call**: ONLY after the producer has explicitly confirmed the pending proposal.  
**Side effects**: Mutates the running order in Redis and Supabase. Triggers Realtime notifications.

```python
@llm.ai_callable(
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
    
    try:
        # Acquire Redis lock
        lock_key = f"session:{self.session.session_id}:lock"
        lock_acquired = await self.session.redis_client.set(
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
            await self.session.redis_client.delete(lock_key)
            return f"ERROR: Invalid running order state: {'; '.join(validation_errors)}"
        
        # Apply to Redis + Supabase
        await self.session.update_running_order(new_ro)
        
        # If a news item was used, mark it
        news_item_id = proposal["proposed_changes"].get("news_item_id")
        if news_item_id:
            await self.session.supabase_client.table("news_items") \
                .update({"is_used": True}) \
                .eq("id", news_item_id) \
                .execute()
        
        # Update proposal status in Supabase
        await self.session.supabase_client.table("proposals") \
            .update({
                "status": "confirmed",
                "producer_response": producer_confirmation,
                "resolved_at": datetime.utcnow().isoformat(),
            }) \
            .eq("id", self.confirmation_guard.current_proposal_id) \
            .execute()
        
        # Log event
        await self.session.supabase_client.table("session_events").insert({
            "session_id": self.session.session_id,
            "event_type": "running_order_updated",
            "payload": {
                "version": new_ro["version"],
                "action": proposal["proposal_type"],
                "summary": proposal["summary"],
            },
            "source": "agent",
        }).execute()
        
        # Mark applied in confirmation guard
        await self.confirmation_guard.mark_applied()
        
        # Release lock
        await self.session.redis_client.delete(lock_key)
        
        return (
            f"Timeline updated successfully (version {new_ro['version']}). "
            f"{len(new_ro['segments'])} segments, "
            f"total duration {new_ro['total_duration_seconds'] // 60} minutes. "
            f"Teleprompter and timeline are synced. "
            f"Now generate the anchor instruction using push_anchor_instruction."
        )
    
    except Exception as e:
        # Release lock on error
        await self.session.redis_client.delete(lock_key)
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
            if seg["start_offset_seconds"] != 0:
                errors.append(f"First segment offset should be 0, got {seg['start_offset_seconds']}")
        else:
            expected = segments[i-1]["start_offset_seconds"] + segments[i-1]["duration_seconds"]
            if seg["start_offset_seconds"] != expected:
                errors.append(
                    f"Offset mismatch for '{seg['title']}': "
                    f"expected {expected}, got {seg['start_offset_seconds']}"
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
```

---

### Tool 5: `push_anchor_instruction`

**Purpose**: Generate and store a clean instruction for the anchor.  
**When to call**: After a timeline update has been applied, or when the producer asks for an anchor instruction.  
**Side effects**: Writes to `anchor_instructions` table. Triggers Realtime notification to the Anchor Instruction panel.

```python
@llm.ai_callable(
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
    instruction_text: Annotated[str, "The clean instruction text for the anchor. Must be concise and actionable."],
    instruction_type: Annotated[str, "Type: 'transition', 'breaking', 'correction', 'timing', 'general'"] = "transition",
    segment_id: Annotated[Optional[str], "ID of the related segment, if applicable"] = None,
) -> str:
    """Generate and store an anchor instruction."""
    
    try:
        result = await self.session.supabase_client.table("anchor_instructions").insert({
            "session_id": self.session.session_id,
            "segment_id": segment_id,
            "instruction_text": instruction_text,
            "instruction_type": instruction_type,
            "status": "pending",
        }).execute()
        
        instruction_id = result.data[0]["id"]
        
        # Log event
        await self.session.supabase_client.table("session_events").insert({
            "session_id": self.session.session_id,
            "event_type": "anchor_instruction_sent",
            "payload": {
                "instruction_id": instruction_id,
                "instruction_type": instruction_type,
                "instruction_text": instruction_text,
            },
            "source": "agent",
        }).execute()
        
        return (
            f"Anchor instruction delivered: \"{instruction_text}\". "
            f"The anchor's teleprompter and instruction panel are updated."
        )
    
    except Exception as e:
        logger.error(f"Failed to push anchor instruction: {e}")
        return f"ERROR: Failed to deliver anchor instruction: {str(e)}"
```

---

## Tool Registration (Toolkit Class)

```python
# apps/agent/tools.py

from livekit.agents import llm


class SudrivToolkit:
    """Registers all tools available to the voice agent."""

    def __init__(self, session: SessionManager):
        self.session = session
        self.confirmation_guard = ConfirmationGuard(session)
    
    def to_function_context(self) -> llm.FunctionContext:
        """Build a FunctionContext with all registered tools."""
        fnc_ctx = llm.FunctionContext()
        
        # Register all tools
        fnc_ctx.ai_callable(self.get_current_running_order)
        fnc_ctx.ai_callable(self.analyze_impact)
        fnc_ctx.ai_callable(self.propose_timeline_update)
        fnc_ctx.ai_callable(self.apply_timeline_update)
        fnc_ctx.ai_callable(self.push_anchor_instruction)
        
        return fnc_ctx

    # ... (all tool methods defined above)
```

---

## Tool Call Safety Rules

### Enforced by the Confirmation Guard

| Rule | Enforcement |
|------|-------------|
| No apply without proposal | `apply_timeline_update` checks `can_apply()` — returns error if no confirmed proposal |
| No apply without confirmation | Confirmation Guard tracks state machine: `NO_PENDING → AWAITING → CONFIRMED → APPLIED` |
| Single pending proposal | Creating a new proposal auto-expires the previous one |
| Proposal expiry | Redis TTL of 5 minutes on pending proposals |
| Concurrent mutation protection | Redis distributed lock acquired before any mutation |

### Enforced by the System Prompt

| Rule | Prompt Instruction |
|------|-------------------|
| Always read before analyzing | "Call get_current_running_order before analyze_impact" |
| Always analyze before proposing | "Call analyze_impact before propose_timeline_update" |
| Always ask before applying | "After propose_timeline_update, ask the producer for confirmation" |
| Never skip steps | "Follow the strict workflow: Read → Analyze → Propose → Confirm → Apply" |

### Enforced by the Validation Layer

| Rule | Validation |
|------|-----------|
| Contiguous positions | `_validate_running_order` checks positions are 1..N |
| Correct offsets | `_validate_running_order` checks offset calculations |
| Positive durations | `_validate_running_order` checks all durations > 0 |
| Total duration consistency | `_validate_running_order` checks sum matches total |

---

## Tool Call Sequence Diagrams

### Typical Insert Flow

```
Producer: "Add the earthquake story after the headlines"
    │
    ▼
LLM decides: call get_current_running_order()
    │
    ▼
LLM receives current running order
    │
    ▼
LLM decides: call analyze_impact(action="insert", target_position=2, ...)
    │
    ▼
LLM receives impact analysis
    │
    ▼
LLM decides: call propose_timeline_update(action="insert", target_position=2, ...)
    │
    ▼
LLM formats response: "I propose inserting the earthquake story at slot 2..."
    │
    ▼
Agent speaks the proposal to the producer
    │
    ▼
Producer: "Yes, do it"
    │
    ▼
LLM decides: call apply_timeline_update(producer_confirmation="Yes, do it")
    │
    ▼
LLM decides: call push_anchor_instruction(instruction_text="After headlines, going to earthquake story...")
    │
    ▼
LLM formats response: "Done. Timeline updated, anchor instruction delivered."
    │
    ▼
Agent speaks confirmation to the producer
```

### Typical Reject Flow

```
Producer: "Move sports to the end"
    │
    ▼
LLM: get_current_running_order() → analyze_impact() → propose_timeline_update()
    │
    ▼
Agent: "I propose moving sports to slot 8. This means..."
    │
    ▼
Producer: "No, forget it"
    │
    ▼
LLM detects rejection → Does NOT call apply_timeline_update
    │
    ▼
Confirmation Guard: proposal remains in AWAITING, will expire in 5 minutes
    │
    ▼
Agent: "Got it, no changes made. The running order stays as is."
```

### Modification Mid-Proposal

```
Agent: "I propose inserting earthquake at slot 3..."
    │
    ▼
Producer: "Make it slot 2 instead"
    │
    ▼
LLM: analyze_impact(target_position=2) → propose_timeline_update(target_position=2)
    │     (old proposal auto-expires)
    ▼
Agent: "Updated proposal: earthquake at slot 2. Impact is..."
    │
    ▼
Producer: "Yes, that's better. Go ahead."
    │
    ▼
LLM: apply_timeline_update() → push_anchor_instruction()
```
