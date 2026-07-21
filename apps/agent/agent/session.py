"""
Session Manager

Manages per-session state: running order cache, news items, and conversation context.

See: knowledge-base/05-voice-agent-design.md (Session Manager)
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("sudriv-agent.session")


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
        Initialize session from LiveKit room metadata.

        Room metadata (set by frontend during session creation) contains:
        - session_id
        - user_id
        - news_category (optional)
        - timeline_name

        TODO:
        1. Parse room metadata
        2. Initialize Redis client (Upstash)
        3. Initialize Supabase client (service role)
        4. Load running order from Redis (or Supabase on cache miss)
        5. Load available news items from Supabase
        """
        metadata = json.loads(room.metadata or "{}")
        session_id = metadata.get("session_id", "demo-session")
        user_id = metadata.get("user_id", "demo-user")
        news_category = metadata.get("news_category")

        logger.info(f"Initializing session {session_id} for user {user_id}")

        # TODO: Initialize clients
        # redis_client = await create_redis_client()
        # supabase_client = create_supabase_client()

        # TODO: Load running order from Redis / Supabase
        running_order = {
            "session_id": session_id,
            "version": 1,
            "total_duration_seconds": 0,
            "segments": [],
        }

        # TODO: Load news items from Supabase
        news_items: list[dict[str, Any]] = []

        return cls(
            session_id=session_id,
            user_id=user_id,
            running_order=running_order,
            available_news_items=news_items,
        )

    def get_running_order_summary(self) -> str:
        """Generate a concise summary for the LLM system prompt."""
        segments = self.running_order.get("segments", [])
        if not segments:
            return "No segments loaded."

        lines = []
        for seg in sorted(segments, key=lambda s: s["position"]):
            offset = seg.get("start_offset_seconds", 0)
            mins, secs = divmod(offset, 60)
            duration_mins = seg.get("duration_seconds", 0) // 60
            lines.append(
                f"  {seg['position']}. [{mins:02d}:{secs:02d}] "
                f"{seg['title']} ({duration_mins}min) - {seg.get('status', 'pending')}"
            )

        total_mins = self.running_order.get("total_duration_seconds", 0) // 60
        return f"Total: {total_mins} minutes, {len(segments)} segments\n" + "\n".join(lines)

    def get_news_items_summary(self) -> str:
        """Generate a concise summary of available news items for the LLM."""
        if not self.available_news_items:
            return "No news items loaded."

        lines = []
        for item in self.available_news_items:
            lines.append(
                f"  - [{item.get('priority', 'medium').upper()}] {item['headline']} "
                f"({item.get('category', 'general')}, "
                f"~{item.get('estimated_duration_seconds', 180) // 60}min)"
            )
        return f"{len(self.available_news_items)} items available:\n" + "\n".join(lines)

    def build_greeting(self) -> str:
        """Build a contextual greeting based on the loaded session."""
        segments = self.running_order.get("segments", [])
        total_mins = self.running_order.get("total_duration_seconds", 0) // 60
        news_count = len(self.available_news_items)

        if not segments:
            return (
                "Namaste! I'm your Sudriv co-pilot. "
                "It looks like the session is being set up. "
                "I'll be ready once the running order is loaded."
            )

        return (
            f"Namaste! I'm your Sudriv co-pilot. "
            f"I've loaded the running order with "
            f"{len(segments)} segments, total duration {total_mins} minutes. "
            f"I have {news_count} news items ready. "
            f"How would you like to begin?"
        )

    async def update_running_order(self, new_order: dict[str, Any]) -> None:
        """
        Update the running order in cache and persist to database.

        TODO:
        1. Write to Redis immediately
        2. Persist to Supabase asynchronously
        """
        self.running_order = new_order
        logger.info(f"Running order updated to version {new_order.get('version', '?')}")

    async def set_pending_proposal(self, proposal: dict[str, Any]) -> None:
        """Store the current pending proposal."""
        self.pending_proposal = proposal
        # TODO: Also store in Redis with 5-minute TTL

    async def clear_pending_proposal(self) -> None:
        """Clear the pending proposal."""
        self.pending_proposal = None
        # TODO: Also delete from Redis
