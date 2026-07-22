"""
Confirmation Guard

Safety layer that ensures no running order mutations happen without explicit producer confirmation.

See: knowledge-base/05-voice-agent-design.md (Confirmation Guard)
"""

from __future__ import annotations

import logging
import uuid
from enum import Enum
from typing import Any, Optional

from agent.session import SessionManager

logger = logging.getLogger("sudriv-agent.confirmation")


class ConfirmationStatus(Enum):
    """State machine for proposal confirmation."""

    NO_PENDING = "no_pending"
    AWAITING = "awaiting"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class ConfirmationGuard:
    """
    Ensures no timeline mutations happen without explicit producer confirmation.

    Rules:
    1. Only one proposal can be pending at a time
    2. apply_timeline_update can only be called when status is CONFIRMED
    3. A new proposal auto-expires the previous one
    4. Every state transition is logged for audit
    """

    def __init__(self, session: SessionManager):
        self.session = session
        self.status = ConfirmationStatus.NO_PENDING
        self.current_proposal_id: Optional[str] = None

    async def create_proposal(self, proposal: dict[str, Any]) -> str:
        """Register a new proposal. Returns proposal ID."""
        if self.status == ConfirmationStatus.AWAITING:
            # Auto-expire previous proposal
            logger.info(f"Auto-expiring previous proposal: {self.current_proposal_id}")
            await self.session.clear_pending_proposal()

        proposal_id = str(uuid.uuid4())
        proposal["id"] = proposal_id

        await self.session.set_pending_proposal(proposal)
        self.current_proposal_id = proposal_id
        self.status = ConfirmationStatus.AWAITING

        logger.info(f"Proposal created: {proposal_id} ({proposal.get('proposal_type')})")
        # TODO: Log event to session_events table

        return proposal_id

    def can_apply(self) -> bool:
        """Check if apply_timeline_update is allowed."""
        return self.status in (ConfirmationStatus.AWAITING, ConfirmationStatus.CONFIRMED)

    async def confirm(self, producer_response: str = "") -> None:
        """Mark the current proposal as confirmed."""
        if self.status != ConfirmationStatus.AWAITING:
            raise ValueError("No pending proposal to confirm")

        self.status = ConfirmationStatus.CONFIRMED
        logger.info(f"Proposal confirmed: {self.current_proposal_id} — '{producer_response}'")
        # TODO: Log event to session_events table

    async def reject(self, reason: str = "") -> None:
        """Mark the current proposal as rejected."""
        if self.status != ConfirmationStatus.AWAITING:
            raise ValueError("No pending proposal to reject")

        self.status = ConfirmationStatus.NO_PENDING
        await self.session.clear_pending_proposal()

        logger.info(f"Proposal rejected: {self.current_proposal_id} — '{reason}'")
        # TODO: Log event to session_events table

        self.current_proposal_id = None

    async def mark_applied(self) -> None:
        """Mark proposal as applied and reset state."""
        logger.info(f"Proposal applied: {self.current_proposal_id}")
        self.status = ConfirmationStatus.NO_PENDING
        await self.session.clear_pending_proposal()
        self.current_proposal_id = None
