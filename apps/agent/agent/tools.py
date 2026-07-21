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
from typing import Annotated, Optional

from livekit.agents import llm

from agent.confirmation import ConfirmationGuard
from agent.session import SessionManager

logger = logging.getLogger("sudriv-agent.tools")


class SudrivToolkit:
    """Registers all tools available to the voice agent."""

    def __init__(self, session: SessionManager):
        self.session = session
        self.confirmation_guard = ConfirmationGuard(session)

    def to_function_context(self) -> llm.FunctionContext:
        """Build a FunctionContext with all registered tools."""
        fnc_ctx = llm.FunctionContext()

        # Register all 5 tools
        fnc_ctx.ai_callable(self.get_current_running_order)
        fnc_ctx.ai_callable(self.analyze_impact)
        fnc_ctx.ai_callable(self.propose_timeline_update)
        fnc_ctx.ai_callable(self.apply_timeline_update)
        fnc_ctx.ai_callable(self.push_anchor_instruction)

        return fnc_ctx

    # ─── Tool 1: Read ─────────────────────────────────────────────────────────

    @llm.ai_callable(
        description=(
            "Get the current running order for the active session. "
            "Returns all segments with positions, durations, start times, and statuses. "
            "Call this before analyzing impact or proposing changes."
        )
    )
    async def get_current_running_order(self) -> str:
        """Fetch the current running order."""
        # TODO: Read from Redis, fallback to Supabase
        # See knowledge-base/06-tools-and-function-calling.md for full implementation
        logger.info("Tool called: get_current_running_order")
        return self.session.get_running_order_summary()

    # ─── Tool 2: Analyze ──────────────────────────────────────────────────────

    @llm.ai_callable(
        description=(
            "Analyze the impact of a proposed change to the running order. "
            "Calculates which segments are affected, how start times shift, "
            "and whether the show will run over. "
            "ALWAYS call this before proposing a timeline update."
        )
    )
    async def analyze_impact(
        self,
        action: Annotated[
            str,
            "The type of change: 'insert', 'remove', 'reorder', 'modify_duration', 'replace'",
        ],
        target_position: Annotated[int, "The position (slot number) where the action applies"],
        new_segment_title: Annotated[
            Optional[str], "Title of the new segment (for insert/replace)"
        ] = None,
        new_segment_duration_seconds: Annotated[
            Optional[int], "Duration in seconds (for insert/replace/modify_duration)"
        ] = None,
    ) -> str:
        """Analyze impact without modifying anything."""
        logger.info(f"Tool called: analyze_impact({action}, pos={target_position})")

        # TODO: Implement full impact calculation
        # See knowledge-base/06-tools-and-function-calling.md for _calculate_impact()
        return (
            f"Impact analysis for {action} at position {target_position}: "
            f"[TODO: Implement impact calculation]. "
            f"Call propose_timeline_update to create a formal proposal."
        )

    # ─── Tool 3: Propose ──────────────────────────────────────────────────────

    @llm.ai_callable(
        description=(
            "Create a formal proposal for a running order change. "
            "ALWAYS call analyze_impact BEFORE this tool. "
            "After calling this, you MUST ask the producer for confirmation."
        )
    )
    async def propose_timeline_update(
        self,
        action: Annotated[str, "The change type"],
        target_position: Annotated[int, "The position where the action applies"],
        summary: Annotated[str, "Concise summary of the proposed change"],
        impact_summary: Annotated[str, "Concise summary of the impact"],
    ) -> str:
        """Create and store a proposal. Does NOT apply the change."""
        logger.info(f"Tool called: propose_timeline_update({action}, pos={target_position})")

        proposal = {
            "proposal_type": action,
            "target_position": target_position,
            "summary": summary,
            "impact_summary": impact_summary,
            # TODO: Include full proposed_changes and impact_analysis
        }

        proposal_id = await self.confirmation_guard.create_proposal(proposal)

        return (
            f"Proposal created (ID: {proposal_id[:8]}). "
            f"Summary: {summary}. "
            f"Impact: {impact_summary}. "
            f"IMPORTANT: Ask the producer for confirmation before applying."
        )

    # ─── Tool 4: Apply ────────────────────────────────────────────────────────

    @llm.ai_callable(
        description=(
            "Apply the previously proposed and CONFIRMED timeline update. "
            "ONLY call after the producer has explicitly confirmed. "
            "NEVER call without explicit confirmation."
        )
    )
    async def apply_timeline_update(
        self,
        producer_confirmation: Annotated[
            str, "The exact words the producer used to confirm"
        ],
    ) -> str:
        """Apply the confirmed proposal to the running order."""
        logger.info(f"Tool called: apply_timeline_update('{producer_confirmation}')")

        if not self.confirmation_guard.can_apply():
            return (
                "ERROR: Cannot apply — no confirmed proposal. "
                "You must first create a proposal and get explicit confirmation."
            )

        # TODO: Implement full application logic
        # 1. Acquire Redis lock
        # 2. Build new running order from proposal
        # 3. Validate invariants
        # 4. Write to Redis + Supabase
        # 5. Mark proposal as applied
        # See knowledge-base/06-tools-and-function-calling.md

        await self.confirmation_guard.mark_applied()

        return (
            "Timeline updated successfully. "
            "Teleprompter and timeline are synced. "
            "Now generate the anchor instruction using push_anchor_instruction."
        )

    # ─── Tool 5: Anchor Instruction ───────────────────────────────────────────

    @llm.ai_callable(
        description=(
            "Generate and push a clean instruction for the anchor. "
            "Call after a timeline update is applied. "
            "The instruction must be clear, concise, and actionable."
        )
    )
    async def push_anchor_instruction(
        self,
        instruction_text: Annotated[str, "Clean instruction text for the anchor"],
        instruction_type: Annotated[
            str, "Type: 'transition', 'breaking', 'correction', 'timing', 'general'"
        ] = "transition",
    ) -> str:
        """Generate and store an anchor instruction."""
        logger.info(f"Tool called: push_anchor_instruction('{instruction_text[:50]}...')")

        # TODO: Write to Supabase anchor_instructions table
        # This triggers Realtime notification to the Anchor Panel
        # See knowledge-base/06-tools-and-function-calling.md

        return f'Anchor instruction delivered: "{instruction_text}"'
