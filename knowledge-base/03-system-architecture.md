# 03 — System Architecture

## Architecture Overview

Sudriv follows a real-time event-driven architecture with three primary planes:

1. **Voice Plane** — LiveKit Cloud handles all voice transport (WebRTC)
2. **Data Plane** — Supabase (Postgres + Realtime) is the source of truth; Redis (Upstash) is the hot cache
3. **Presentation Plane** — Next.js frontend renders the timeline, teleprompter, and session UI

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRODUCER (Browser)                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │   Timeline    │  │ Teleprompter │  │  Anchor    │  │  Voice   │ │
│  │   View        │  │   View       │  │  Instruct  │  │  Panel   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘ │
│         │                  │                │               │       │
│         └──────────────────┴────────────────┴───────────────┘       │
│                            │                          │             │
│                    Supabase Realtime            LiveKit WebRTC      │
│                    (data subscription)          (audio stream)      │
└────────────────────────────┼──────────────────────────┼─────────────┘
                             │                          │
                             ▼                          ▼
┌────────────────────────────────────┐    ┌───────────────────────────┐
│         SUPABASE CLOUD             │    │      LIVEKIT CLOUD        │
│                                    │    │                           │
│  ┌──────────┐  ┌────────────────┐  │    │  ┌─────────────────────┐ │
│  │ Postgres │  │  Realtime      │  │    │  │   Room Server       │ │
│  │   (SoT)  │  │  (WebSocket)   │  │    │  │   (WebRTC SFU)     │ │
│  └──────────┘  └────────────────┘  │    │  └──────────┬──────────┘ │
│                                    │    │             │             │
│  ┌──────────┐  ┌────────────────┐  │    │  ┌──────────▼──────────┐ │
│  │   Auth   │  │  Row Level     │  │    │  │   Agent Runtime     │ │
│  │          │  │  Security      │  │    │  │   (Python)          │ │
│  └──────────┘  └────────────────┘  │    │  └──────────┬──────────┘ │
└────────────────────────────────────┘    └─────────────┼─────────────┘
                     ▲                                  │
                     │                                  │
                     │              ┌───────────────────▼──────────┐
                     │              │       VOICE AGENT            │
                     │              │     (LiveKit Agents SDK)     │
                     │              │                              │
                     │              │  ┌────┐ ┌─────┐ ┌────────┐  │
                     │              │  │STT │ │ LLM │ │  TTS   │  │
                     │              │  │    │ │     │ │        │  │
                     │              │  │Sar-│ │Groq │ │ Sarvam │  │
                     │              │  │vam │ │Llama│ │ Bulbul │  │
                     │              │  └────┘ └──┬──┘ └────────┘  │
                     │              │            │                 │
                     │              │    ┌───────▼───────┐        │
                     │              │    │  Tool Calls   │        │
                     │              │    │  (Functions)  │        │
                     │              │    └───────┬───────┘        │
                     │              └────────────┼────────────────┘
                     │                           │
                     │              ┌────────────▼────────────────┐
                     └──────────────│        REDIS (Upstash)      │
                                   │       Hot State Cache        │
                                   └─────────────────────────────┘
```

---

## Component Breakdown

### 1. Frontend (Next.js 15)

**Deployment**: Vercel  
**Runtime**: Edge + Node.js hybrid  
**State Management**: Server Components + React Context for session state  

| Module | Responsibility |
|--------|---------------|
| Auth Module | Login, session management via Supabase Auth |
| Dashboard | Timeline selection, session setup |
| Session View | Main production interface during active session |
| Timeline Panel | Visual running order with drag-and-drop (@dnd-kit) |
| Teleprompter Panel | Live teleprompter text display |
| Anchor Instruction Panel | Generated instructions for the anchor |
| Voice Panel | LiveKit room connection, mic controls, agent status |
| Real-time Sync | Supabase Realtime subscriptions for all data changes |

### 2. Voice Agent (LiveKit Agents SDK — Python)

**Deployment**: LiveKit Cloud (Agent Runtime)  
**Framework**: `livekit-agents` Python SDK  
**Pattern**: VoicePipelineAgent with function calling  

| Component | Responsibility |
|-----------|---------------|
| Agent Entry Point | Worker process that connects to LiveKit rooms |
| Voice Pipeline | STT → LLM → TTS orchestration |
| Tool Registry | Registers callable functions for the LLM |
| Session Manager | Manages per-session state and context |
| Confirmation Guard | Ensures no mutations happen without explicit confirmation |
| News Context Provider | Loads and provides pre-loaded news items to the LLM |

### 3. Supabase (Source of Truth)

**Services Used**:
- **Postgres**: Persistent storage for all data
- **Realtime**: WebSocket-based change notifications to frontend
- **Auth**: Single-user authentication for MVP
- **Row Level Security (RLS)**: Data access control

### 4. Redis / Upstash (Hot State)

**Purpose**: Low-latency cache for the active session's running order  
**Pattern**: Write-through cache (write to Redis first, async persist to Supabase)  

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `session:{id}:running_order` | Full running order JSON | Session duration + 1 hour |
| `session:{id}:pending_proposal` | Current unapplied proposal | 5 minutes |
| `session:{id}:agent_context` | Agent's accumulated context | Session duration |
| `session:{id}:lock` | Mutex for concurrent write protection | 30 seconds |

---

## Data Flow Patterns

### Pattern 1: Voice Command → Timeline Update

```
Producer speaks
    │
    ▼
LiveKit WebRTC ──▶ Agent receives audio
    │
    ▼
Sarvam STT ──▶ Text transcription
    │
    ▼
Groq LLM ──▶ Intent understanding + tool call decision
    │
    ▼
Tool: analyze_impact() ──▶ Read running order from Redis
    │                        Calculate cascading changes
    ▼                        Return impact analysis
LLM formats proposal ──▶ Sarvam TTS ──▶ Agent speaks proposal
    │
    ▼
Producer confirms (voice)
    │
    ▼
Tool: apply_timeline_update() ──▶ Write to Redis (immediate)
    │                               Persist to Supabase (async)
    ▼
Supabase Realtime ──▶ Frontend receives change notification
    │
    ▼
UI updates: Timeline + Teleprompter + Anchor Instruction
```

**Total target latency: < 2 seconds** from producer confirmation to UI update.

### Pattern 2: Manual UI Change → Agent Sync

```
Producer drags segment in UI
    │
    ▼
Frontend writes to Supabase ──▶ Supabase Realtime notification
    │                               │
    ▼                               ▼
Redis cache invalidated        Agent receives change notification
    │                               │
    ▼                               ▼
Redis updated from Supabase    Agent acknowledges change verbally
```

### Pattern 3: Proactive News Alert

```
Session starts ──▶ Agent loads pre-loaded news items
    │
    ▼
Agent evaluates news priority vs current running order
    │
    ▼
High-priority item identified
    │
    ▼
Agent speaks alert to Producer
    │
    ▼
(Continues to Flow 3b from User Flows)
```

---

## Latency Budget

Every millisecond matters. Here's the latency budget for the critical path (voice command → UI update):

| Stage | Budget | Notes |
|-------|--------|-------|
| WebRTC audio capture → Agent | 50ms | LiveKit SFU, geo-optimized |
| STT (Sarvam Saaras v3) | 200-400ms | Streaming mode, partial results |
| LLM intent + tool call (Groq) | 200-400ms | Groq's speed advantage; streaming |
| Tool execution (Redis read/write) | 10-50ms | Upstash global edge |
| LLM response generation (Groq) | 200-400ms | Streaming tokens |
| TTS (Sarvam Bulbul v3) | 150-300ms | Streaming audio chunks |
| WebRTC audio delivery → Producer | 50ms | LiveKit SFU |
| Supabase persist + Realtime notify | 200-500ms | Async, not blocking voice |
| Frontend React re-render | 50-100ms | Optimistic + subscription |
| **Total (voice round-trip)** | **~1-2 seconds** | **End-to-end target** |

> **Key insight**: The voice response to the producer and the UI update happen in parallel. The producer hears "Done" from the agent while the UI is simultaneously updating.

---

## Reliability & Failure Modes

### Failure: STT Service Down
- **Detection**: Timeout after 5 seconds with no transcription
- **Mitigation**: Display "Voice input unavailable" in UI. Producer uses manual controls.
- **Recovery**: Automatic reconnection with exponential backoff

### Failure: LLM Service Down
- **Detection**: Timeout after 10 seconds, or error response
- **Mitigation**: Agent says "I'm having trouble processing. Please use the manual controls."
- **Recovery**: Automatic retry with fallback to a secondary LLM endpoint (future)

### Failure: Redis Unavailable
- **Detection**: Connection error or timeout
- **Mitigation**: Fall back to reading/writing directly from Supabase
- **Recovery**: Automatic reconnection; Redis cache rebuilt from Supabase on recovery

### Failure: Supabase Realtime Disconnection
- **Detection**: WebSocket close event
- **Mitigation**: Frontend shows "Reconnecting..." banner. Local state preserved.
- **Recovery**: Automatic WebSocket reconnection; full state sync on reconnect

### Failure: LiveKit Room Disconnection
- **Detection**: Room disconnection event
- **Mitigation**: Show "Voice disconnected" in UI. Attempt auto-reconnect.
- **Recovery**: Re-join room with same participant identity; agent state preserved in Redis

---

## Security Considerations (MVP)

| Concern | Approach |
|---------|----------|
| Authentication | Supabase Auth with single pre-configured user |
| API Access | Supabase RLS policies restrict data to authenticated user |
| Agent ↔ Supabase | Service role key (server-side only, never exposed to client) |
| Agent ↔ Redis | Upstash REST API with auth token |
| LiveKit Room Access | Token-based room access with short-lived tokens |
| Environment Secrets | Stored in Vercel (frontend), LiveKit Cloud (agent) environment variables |

---

## Deployment Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel     │     │  LiveKit     │     │  Supabase    │
│   (Frontend) │     │  Cloud       │     │  Cloud       │
│              │     │  (Agent +    │     │  (Postgres + │
│  Next.js 15  │     │   Rooms)     │     │   Realtime + │
│  Edge + Node │     │              │     │   Auth)      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       │              ┌─────▼──────┐              │
       │              │  Upstash   │              │
       │              │  Redis     │              │
       │              │  (Global   │              │
       │              │   Edge)    │              │
       └──────────────┴────────────┴──────────────┘
                   All communicate via
                   HTTPS / WSS / WebRTC
```

### Environment Configuration

| Service | Required Environment Variables |
|---------|-------------------------------|
| Vercel (Frontend) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| LiveKit Cloud (Agent) | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, `GROQ_API_KEY`, `SARVAM_API_KEY` |
