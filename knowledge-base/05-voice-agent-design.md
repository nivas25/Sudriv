# 05 — Voice Agent Design

## Overview

The Voice Agent is the core intelligence of Sudriv. It is a Python application built on the **LiveKit Agents SDK** that connects to a LiveKit room, listens to the producer's voice, processes intent through an LLM, executes tools to read and modify the running order, and responds with synthesized speech.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LiveKit Agent Worker                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                 VoicePipelineAgent                       │     │
│  │                                                         │     │
│  │   ┌─────────┐    ┌──────────┐    ┌─────────────┐      │     │
│  │   │   STT   │───▶│   LLM    │───▶│    TTS      │      │     │
│  │   │ Sarvam  │    │  Groq    │    │   Sarvam    │      │     │
│  │   │ Saaras  │    │  Llama   │    │   Bulbul    │      │     │
│  │   └─────────┘    └────┬─────┘    └─────────────┘      │     │
│  │                       │                                 │     │
│  │                  ┌────▼─────────────────────┐          │     │
│  │                  │     Tool Executor         │          │     │
│  │                  │                           │          │     │
│  │                  │  get_current_running_order│          │     │
│  │                  │  analyze_impact           │          │     │
│  │                  │  propose_timeline_update  │          │     │
│  │                  │  apply_timeline_update    │          │     │
│  │                  │  push_anchor_instruction  │          │     │
│  │                  └────┬─────────────────────┘          │     │
│  │                       │                                 │     │
│  │                  ┌────▼──────┐  ┌──────────────┐       │     │
│  │                  │   Redis   │  │   Supabase   │       │     │
│  │                  │  (Cache)  │  │    (SoT)     │       │     │
│  │                  └───────────┘  └──────────────┘       │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌──────────────────────┐  ┌─────────────────────────────┐      │
│  │  Session Manager     │  │  Confirmation Guard          │      │
│  │  (per-room state)    │  │  (mutation safety layer)     │      │
│  └──────────────────────┘  └─────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Entry Point

The agent runs as a LiveKit worker process. It listens for new rooms and dispatches an agent instance per room.

```python
# apps/agent/main.py

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice import VoicePipelineAgent
from livekit.plugins import groq, sarvam  # or custom plugin wrappers

from tools import SudrivToolkit
from session import SessionManager
from prompts import SYSTEM_PROMPT


async def entrypoint(ctx: JobContext):
    """Called when a new room is created. One agent per session."""
    
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Wait for the producer to join
    participant = await ctx.wait_for_participant()
    
    # Initialize session from room metadata
    session = await SessionManager.from_room(ctx.room)
    
    # Initialize the toolkit with session context
    toolkit = SudrivToolkit(session=session)
    
    # Build the voice pipeline
    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=sarvam.STT(
            model="saaras:v3",
            language="hi-IN",  # Handles Hindi + English + Hinglish
        ),
        llm=groq.LLM(
            model="llama-3.3-70b-versatile",
            temperature=0.3,  # Low temperature for precision
        ),
        tts=sarvam.TTS(
            model="bulbul:v3",
            voice="meera",  # Natural Indian English voice
        ),
        chat_ctx=build_chat_context(session),
        fnc_ctx=toolkit.to_function_context(),
        allow_interruptions=True,
        interrupt_speech_duration=0.5,  # seconds before treating as real interruption
        interrupt_min_words=1,
        min_endpointing_delay=0.5,
    )
    
    agent.start(ctx.room, participant)
    
    # Greeting
    await agent.say(build_greeting(session))


def build_chat_context(session: SessionManager) -> llm.ChatContext:
    """Build the initial chat context with system prompt and session data."""
    ctx = llm.ChatContext()
    ctx.append(
        role="system",
        text=SYSTEM_PROMPT.format(
            running_order_summary=session.get_running_order_summary(),
            news_items_summary=session.get_news_items_summary(),
            session_id=session.session_id,
        ),
    )
    return ctx


def build_greeting(session: SessionManager) -> str:
    """Build a contextual greeting based on the loaded session."""
    ro = session.running_order
    news_count = len(session.available_news_items)
    
    return (
        f"Namaste! I'm your Sudriv co-pilot. "
        f"I've loaded the {ro['name']} running order with "
        f"{len(ro['segments'])} segments, total duration "
        f"{ro['total_duration_seconds'] // 60} minutes. "
        f"I have {news_count} news items ready. "
        f"How would you like to begin?"
    )


def prewarm(proc: JobProcess):
    """Pre-warm expensive resources once per worker process."""
    proc.userdata["vad"] = silero.VAD.load()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        ),
    )
```

---

## System Prompt

The system prompt is the most critical piece of the agent. It defines behavior, boundaries, and communication style.

```python
# apps/agent/prompts.py

SYSTEM_PROMPT = """You are Sudriv, an AI co-pilot for a live television news producer. You are sitting in the Production Control Room (PCR) helping the producer manage a live broadcast.

## Your Role
- You help the producer manage the Running Order (timeline of news segments)
- You propose changes, analyze impact, and execute updates ONLY after explicit confirmation
- You are voice-first: keep responses concise and actionable
- You speak naturally in English, Hindi, or Hinglish — match the producer's language

## Current Session
- Running Order: {running_order_summary}
- Available News Items: {news_items_summary}
- Session ID: {session_id}

## Critical Rules

### 1. NEVER modify the running order without explicit confirmation
- Always propose first, then wait for confirmation
- "Should I apply this?" must come before any mutation
- If the producer says anything ambiguous, ask for clarification

### 2. Follow the strict workflow
1. READ: Use get_current_running_order to see current state
2. ANALYZE: Use analyze_impact to calculate effects of a change
3. PROPOSE: Use propose_timeline_update to create a formal proposal
4. WAIT: Tell the producer the proposal and ask for confirmation
5. APPLY: Only use apply_timeline_update after explicit "yes" / "confirmed" / "go ahead"

### 3. Keep it concise
- This is live TV. Every second counts.
- Don't over-explain. Be direct.
- Good: "Earthquake story goes to slot 3. Sports moves to 4, starts 3 minutes late. Apply?"
- Bad: "I've carefully analyzed the running order and I believe that inserting the earthquake story..."

### 4. Impact analysis must be complete
- Always mention: which segments move, new start times, total duration change
- If the show will run over, explicitly say so and suggest fixes
- Never hide negative impacts

### 5. Handle interruptions gracefully
- If the producer interrupts, stop immediately and listen
- Don't repeat what you were saying unless asked
- Acknowledge the interruption naturally

### 6. Proactive but not pushy
- You can alert the producer about high-priority news items
- But don't keep repeating alerts for the same item
- One alert per item, then wait for the producer to bring it up

### 7. Error handling
- If a tool call fails, say "I'm having trouble with that. Let me try again."
- If you can't understand the request, ask for clarification
- Never make up data. If you don't know, say so.

## Communication Style
- Professional but warm
- Concise and direct
- Use broadcast terminology (slug, package, live hit, SOT, VO, etc.)
- Match the producer's energy and language
- Numbers should be spoken naturally ("three minutes" not "180 seconds")

## Language Behavior
- Default to English
- Switch to Hindi or Hinglish if the producer speaks in Hindi/Hinglish
- Mix naturally — don't force one language
- For technical terms (segment, running order, teleprompter), use English even in Hindi conversation
"""
```

---

## Session Manager

The Session Manager handles per-session state, including the running order cache, news items, and conversation context.

```python
# apps/agent/session.py

import json
from typing import Optional
from dataclasses import dataclass, field

import redis.asyncio as redis
from supabase import AsyncClient as SupabaseClient


@dataclass
class SessionManager:
    session_id: str
    user_id: str
    running_order: dict
    available_news_items: list[dict]
    redis_client: redis.Redis
    supabase_client: SupabaseClient
    pending_proposal: Optional[dict] = None
    _conversation_context: dict = field(default_factory=dict)

    @classmethod
    async def from_room(cls, room) -> "SessionManager":
        """Initialize session from LiveKit room metadata."""
        metadata = json.loads(room.metadata or "{}")
        session_id = metadata["session_id"]
        
        # Initialize clients
        redis_client = redis.from_url(os.environ["UPSTASH_REDIS_URL"])
        supabase_client = create_supabase_client()
        
        # Load running order from Redis (or Supabase if cache miss)
        running_order = await cls._load_running_order(
            redis_client, supabase_client, session_id
        )
        
        # Load available news items from Supabase
        news_items = await cls._load_news_items(
            supabase_client, metadata.get("news_category")
        )
        
        return cls(
            session_id=session_id,
            user_id=metadata["user_id"],
            running_order=running_order,
            available_news_items=news_items,
            redis_client=redis_client,
            supabase_client=supabase_client,
        )

    @staticmethod
    async def _load_running_order(redis_client, supabase_client, session_id):
        """Load running order from Redis, falling back to Supabase."""
        cached = await redis_client.get(f"session:{session_id}:running_order")
        if cached:
            return json.loads(cached)
        
        # Cache miss — load from Supabase
        result = await supabase_client.table("running_orders") \
            .select("*, segments(*)") \
            .eq("session_id", session_id) \
            .order("version", desc=True) \
            .limit(1) \
            .execute()
        
        if not result.data:
            raise ValueError(f"No running order found for session {session_id}")
        
        ro = result.data[0]
        # Cache in Redis
        await redis_client.set(
            f"session:{session_id}:running_order",
            json.dumps(ro),
            ex=7200,  # 2 hour TTL
        )
        return ro

    @staticmethod
    async def _load_news_items(supabase_client, category=None):
        """Load available news items, optionally filtered by category."""
        query = supabase_client.table("news_items") \
            .select("*") \
            .eq("is_used", False)
        
        if category:
            query = query.eq("category", category)
        
        result = await query.order("priority").execute()
        return result.data or []

    def get_running_order_summary(self) -> str:
        """Generate a concise summary for the LLM system prompt."""
        segments = self.running_order.get("segments", [])
        lines = []
        for seg in sorted(segments, key=lambda s: s["position"]):
            offset = seg["start_offset_seconds"]
            mins, secs = divmod(offset, 60)
            duration_mins = seg["duration_seconds"] // 60
            lines.append(
                f"  {seg['position']}. [{mins:02d}:{secs:02d}] "
                f"{seg['title']} ({duration_mins}min) - {seg['status']}"
            )
        total_mins = self.running_order.get("total_duration_seconds", 0) // 60
        return f"Total: {total_mins} minutes, {len(segments)} segments\n" + "\n".join(lines)

    def get_news_items_summary(self) -> str:
        """Generate a concise summary of available news items."""
        lines = []
        for item in self.available_news_items:
            lines.append(
                f"  - [{item['priority'].upper()}] {item['headline']} "
                f"({item['category']}, ~{item['estimated_duration_seconds'] // 60}min)"
            )
        return f"{len(self.available_news_items)} items available:\n" + "\n".join(lines)

    async def update_running_order(self, new_order: dict):
        """Update the running order in cache and persist to database."""
        self.running_order = new_order
        
        # Write to Redis immediately
        await self.redis_client.set(
            f"session:{self.session_id}:running_order",
            json.dumps(new_order),
            ex=7200,
        )
        
        # Persist to Supabase asynchronously
        await self._persist_to_supabase(new_order)

    async def set_pending_proposal(self, proposal: dict):
        """Store the current pending proposal."""
        self.pending_proposal = proposal
        await self.redis_client.set(
            f"session:{self.session_id}:pending_proposal",
            json.dumps(proposal),
            ex=300,  # 5 minute TTL
        )

    async def clear_pending_proposal(self):
        """Clear the pending proposal."""
        self.pending_proposal = None
        await self.redis_client.delete(
            f"session:{self.session_id}:pending_proposal"
        )

    async def _persist_to_supabase(self, running_order: dict):
        """Persist running order to Supabase (async, non-blocking to voice)."""
        # Create new version
        new_version = running_order.get("version", 0) + 1
        
        ro_result = await self.supabase_client.table("running_orders").insert({
            "session_id": self.session_id,
            "version": new_version,
            "total_duration_seconds": running_order["total_duration_seconds"],
        }).execute()
        
        ro_id = ro_result.data[0]["id"]
        
        # Insert all segments
        segments_data = []
        for seg in running_order["segments"]:
            segments_data.append({
                "running_order_id": ro_id,
                "position": seg["position"],
                "title": seg["title"],
                "slug": seg["slug"],
                "segment_type": seg["segment_type"],
                "duration_seconds": seg["duration_seconds"],
                "start_offset_seconds": seg["start_offset_seconds"],
                "status": seg["status"],
                "teleprompter_text": seg.get("teleprompter_text", ""),
                "news_item_id": seg.get("news_item_id"),
            })
        
        await self.supabase_client.table("segments").insert(segments_data).execute()
```

---

## Confirmation Guard

The Confirmation Guard is a safety layer that prevents any running order mutation without explicit producer confirmation.

```python
# apps/agent/confirmation.py

from enum import Enum
from typing import Optional


class ConfirmationStatus(Enum):
    NO_PENDING = "no_pending"
    AWAITING = "awaiting"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    MODIFIED = "modified"


class ConfirmationGuard:
    """
    Ensures no timeline mutations happen without explicit producer confirmation.
    
    Rules:
    1. Only one proposal can be pending at a time
    2. apply_timeline_update can only be called when status is CONFIRMED
    3. A new proposal auto-expires the previous one
    4. The guard logs every state transition for audit
    """

    def __init__(self, session_manager):
        self.session = session_manager
        self.status = ConfirmationStatus.NO_PENDING
        self.current_proposal_id: Optional[str] = None

    async def create_proposal(self, proposal: dict) -> str:
        """Register a new proposal. Returns proposal ID."""
        if self.status == ConfirmationStatus.AWAITING:
            # Auto-expire previous proposal
            await self._expire_current()
        
        proposal_id = str(uuid.uuid4())
        proposal["id"] = proposal_id
        
        await self.session.set_pending_proposal(proposal)
        self.current_proposal_id = proposal_id
        self.status = ConfirmationStatus.AWAITING
        
        # Log event
        await self._log_event("proposal_created", {
            "proposal_id": proposal_id,
            "proposal_type": proposal.get("proposal_type"),
        })
        
        return proposal_id

    def can_apply(self) -> bool:
        """Check if apply_timeline_update is allowed."""
        return self.status == ConfirmationStatus.CONFIRMED

    async def confirm(self, producer_response: str = ""):
        """Mark the current proposal as confirmed."""
        if self.status != ConfirmationStatus.AWAITING:
            raise ValueError("No pending proposal to confirm")
        
        self.status = ConfirmationStatus.CONFIRMED
        
        await self._log_event("proposal_confirmed", {
            "proposal_id": self.current_proposal_id,
            "producer_response": producer_response,
        })

    async def reject(self, reason: str = ""):
        """Mark the current proposal as rejected."""
        if self.status != ConfirmationStatus.AWAITING:
            raise ValueError("No pending proposal to reject")
        
        self.status = ConfirmationStatus.NO_PENDING
        await self.session.clear_pending_proposal()
        
        await self._log_event("proposal_rejected", {
            "proposal_id": self.current_proposal_id,
            "reason": reason,
        })
        
        self.current_proposal_id = None

    async def mark_applied(self):
        """Mark proposal as applied and reset state."""
        self.status = ConfirmationStatus.NO_PENDING
        await self.session.clear_pending_proposal()
        self.current_proposal_id = None

    async def _expire_current(self):
        """Expire the current pending proposal."""
        await self.session.clear_pending_proposal()
        await self._log_event("proposal_expired", {
            "proposal_id": self.current_proposal_id,
        })
        self.current_proposal_id = None

    async def _log_event(self, event_type: str, payload: dict):
        """Log confirmation events to the session event log."""
        await self.session.supabase_client.table("session_events").insert({
            "session_id": self.session.session_id,
            "event_type": event_type,
            "payload": payload,
            "source": "agent",
        }).execute()
```

---

## Agent Lifecycle

### Startup Sequence

```
1. Worker process starts (prewarm: load VAD model)
2. Worker registers with LiveKit Cloud
3. Room created (triggered by frontend starting session)
4. Worker receives job for the room
5. entrypoint() called
6. Agent connects to room (audio only)
7. Waits for producer participant to join
8. Initializes SessionManager (loads running order + news items)
9. Initializes ConfirmationGuard
10. Initializes SudrivToolkit
11. Creates VoicePipelineAgent with all components
12. Starts the agent
13. Delivers greeting
14. Enters voice conversation loop
```

### Conversation Loop

The `VoicePipelineAgent` handles the conversation loop automatically:

```
┌──────────────────────────────────────────────┐
│              CONVERSATION LOOP                │
│                                              │
│  Listen (VAD detects speech)                 │
│      │                                       │
│      ▼                                       │
│  STT (stream audio → text)                   │
│      │                                       │
│      ▼                                       │
│  LLM (text → response + optional tool calls) │
│      │                                       │
│      ├── Tool call? ──▶ Execute tool         │
│      │                    │                   │
│      │                    ▼                   │
│      │              Return result to LLM     │
│      │                    │                   │
│      │                    ▼                   │
│      │              LLM generates response   │
│      │                                       │
│      ▼                                       │
│  TTS (response text → audio)                 │
│      │                                       │
│      ▼                                       │
│  Play audio to producer                      │
│      │                                       │
│      └──── Loop ─────────────────────────────┘
│                                              │
│  [Interruption detected] ──▶ Stop TTS        │
│                              Listen again    │
└──────────────────────────────────────────────┘
```

### Shutdown Sequence

```
1. Producer says "end session" or disconnects
2. Agent says goodbye
3. Agent disconnects from room
4. Session state finalized in Supabase
5. Redis keys cleared
6. Worker process available for next job
```

---

## Error Handling Strategy

| Error | Agent Behavior | Recovery |
|-------|---------------|----------|
| STT timeout (> 5s no result) | "I didn't catch that, could you repeat?" | Automatic retry |
| STT garbled output | "I'm having trouble understanding. Could you say that again?" | Ask for repetition |
| LLM timeout (> 10s) | "Give me a moment..." → retry once | If retry fails: "I'm having technical difficulties. Please use the manual controls." |
| LLM invalid tool call | Silently retry with corrected parameters | If persistent: escalate to error message |
| Redis connection error | Fallback to Supabase directly | Reconnect in background |
| Supabase write failure | "The change is saved locally but I'm having trouble syncing. I'll keep trying." | Retry with backoff |
| Tool execution error | "I ran into an issue with that operation. Let me try again." | Retry once, then manual fallback |

---

## Performance Optimization

### Pre-warming
- VAD model loaded once per worker process, shared across all sessions
- Redis connection pool maintained per worker
- Supabase client initialized once per worker

### Streaming
- STT: Streaming mode enabled — partial results sent to LLM as they arrive
- LLM: Streaming tokens — TTS starts as soon as first tokens arrive
- TTS: Streaming audio — playback starts before full synthesis completes

### Context Management
- Keep LLM context lean: running order summary + relevant news items only
- Don't send full teleprompter text to LLM (only summaries)
- Periodically summarize conversation history to prevent context overflow
- Maximum conversation history: 50 turns, then summarize oldest 25
