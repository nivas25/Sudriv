# 11 — Technical Decisions & Tradeoffs

## Overview

This document captures the key technical decisions made for Sudriv, the alternatives considered, and the reasoning behind each choice. Every decision is framed as a tradeoff — what we gain and what we give up.

---

## Decision 1: LiveKit Agents over Custom WebSocket Pipeline

### Decision
Use LiveKit's managed infrastructure (LiveKit Cloud + Agents SDK) instead of building a custom WebRTC/WebSocket voice pipeline.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **LiveKit Agents (chosen)** | Managed infrastructure, built-in VAD/interruption, agent hosting, proven scale | Vendor lock-in, limited customization, cost at scale |
| Custom WebSocket + VAD | Full control, no vendor lock-in | 3-6 months of engineering, edge cases in echo cancellation/VAD |
| Twilio Voice | Mature telephony, PSTN integration | Phone-optimized not web-optimized, higher latency, expensive |
| Daily.co | Good WebRTC, AI-friendly | Smaller ecosystem, less agent-specific tooling |

### Rationale
Building reliable real-time voice infrastructure from scratch is a 6+ month effort covering WebRTC, TURN servers, VAD, echo cancellation, jitter buffers, and interruption handling. LiveKit has solved these problems at scale. The Agents SDK specifically handles the STT→LLM→TTS pipeline with first-class support for tool calling and interruption. For an MVP, this is the right tradeoff: **ship fast, prove value, then optimize**.

### What We Give Up
- Direct control over audio processing pipeline
- Ability to run fully on-premise (LiveKit Cloud dependency)
- Some optimization flexibility in the voice pipeline

### Migration Path
If we need to migrate away from LiveKit, the agent logic (tools, session management, confirmation guard) is decoupled from the voice transport. The main rewrite would be the voice pipeline orchestration.

---

## Decision 2: Groq over OpenAI/Anthropic for LLM

### Decision
Use Groq (Llama 3.3 70B) as the primary LLM instead of GPT-4o or Claude.

### Alternatives Considered

| Option | TTFT | Tokens/sec | Function Calling | Hindi/Hinglish | Cost (1M input) |
|--------|------|-----------|-----------------|----------------|-----------------|
| **Groq Llama 3.3 70B (chosen)** | ~200ms | 300+ | Good | Good | $0.59 |
| OpenAI GPT-4o | ~500ms | ~100 | Excellent | Good | $2.50 |
| Anthropic Claude 3.5 Sonnet | ~600ms | ~80 | Good | Good | $3.00 |
| Google Gemini 2.0 Flash | ~300ms | ~150 | Good | Good | $0.10 |

### Rationale
For a voice pipeline, **TTFT (Time to First Token) is the single most important LLM metric**. It directly determines how long the producer waits between finishing their sentence and hearing the AI's response. Groq's ~200ms TTFT is 2-3x faster than alternatives.

Function calling quality is "good enough" — not as robust as GPT-4o, but adequate for our 5 well-defined tools. The system prompt constraints and validation layer compensate for occasional tool call format issues.

### What We Give Up
- GPT-4o's superior function calling reliability (mitigated by validation + retry)
- Claude's longer context window (mitigated by context pruning)
- Potentially better reasoning on complex multi-step operations

### Fallback Strategy
If Groq is unavailable, we can fall back to Google Gemini 2.0 Flash (next fastest) or GPT-4o-mini. The system prompt and tool definitions are model-agnostic.

---

## Decision 3: Sarvam over Google/Whisper for STT & TTS

### Decision
Use Sarvam AI (Saaras v3 for STT, Bulbul v3 for TTS) as the primary voice services.

### Rationale
Sarvam is purpose-built for Indian languages. The critical differentiator is **Hinglish code-switching** — the natural mix of Hindi and English that Indian professionals use daily. Google Cloud STT handles Hindi and English separately but struggles with mid-sentence language switching. Whisper is batch-only (no streaming), which is unsuitable for real-time voice.

### What We Give Up
- Google's massive language coverage (not needed — we only need English + Hindi)
- Whisper's accuracy on pure English (marginal difference)
- Larger vendor stability (Sarvam is a smaller company)

### Risk Mitigation
- If Sarvam's API is unavailable, fall back to Google Cloud STT (streaming) + Google Cloud TTS
- Monitor Sarvam's uptime and latency in production
- Keep the plugin interface abstract so swapping providers is a configuration change

---

## Decision 4: Supabase Realtime over WebSocket Server

### Decision
Use Supabase's built-in Realtime feature for all frontend data synchronization instead of building a custom WebSocket server.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Supabase Realtime (chosen)** | Zero infrastructure, automatic with DB writes, row-level filtering | Limited control, slight latency overhead, dependent on Supabase |
| Custom WebSocket (ws/Socket.io) | Full control, arbitrary messages | Need to build, deploy, and scale a WebSocket server |
| Pusher/Ably | Managed, reliable | Additional vendor, cost, no DB integration |
| Firebase Realtime | Google-backed, proven | Requires Firebase ecosystem, not Postgres |

### Rationale
Supabase Realtime eliminates an entire infrastructure component. When the agent writes to Postgres (running orders, anchor instructions), the frontend automatically receives the update via WebSocket — no additional publish/subscribe infrastructure needed. This is **architecturally elegant and operationally simple**.

### What We Give Up
- Arbitrary message types (limited to DB row changes)
- Sub-10ms latency (Supabase Realtime is typically 100-500ms)
- Fine-grained control over message ordering and batching

### Latency Impact
Supabase Realtime adds ~200-500ms latency for data propagation to the frontend. This is acceptable because:
1. The producer hears the agent's voice response before the UI updates (voice is faster)
2. The UI update is a confirmation of what the producer already heard
3. Sub-second UI updates feel "instant" to users

---

## Decision 5: Redis (Upstash) for Hot State over In-Memory

### Decision
Use Redis (Upstash) as the hot state cache instead of in-memory state within the agent process.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Redis/Upstash (chosen)** | Survives agent restart, shared state, distributed lock | Network latency (~10ms), additional dependency |
| In-memory (agent process) | Zero latency, simple | Lost on restart, not shared, no distributed lock |
| Supabase only | Single source, no cache layer | Higher latency for reads (~50-100ms), no atomic locks |

### Rationale
The voice agent process may crash, restart, or be replaced during a session (especially on LiveKit Cloud which manages agent lifecycle). Redis ensures the running order state survives agent restarts without requiring a full reload from Supabase.

Additionally, the distributed lock (`session:{id}:lock`) prevents concurrent mutations if, for any reason, two agent instances exist simultaneously (race condition during restart).

### What We Give Up
- Simplicity (one more moving part)
- ~10ms added latency per cache operation (negligible)
- Upstash cost (minimal for MVP volume)

---

## Decision 6: Running Order Versioning over Soft Deletes

### Decision
Create a new `running_orders` row with an incremented version for every mutation, rather than modifying segments in place with soft-delete flags.

### Rationale
Versioning provides:
1. **Full audit trail**: Every state of the running order is preserved
2. **Easy rollback**: Revert to any previous version by reading an older row
3. **Conflict-free writes**: No need for optimistic locking on individual segments
4. **Clean Realtime notifications**: Frontend subscribes to INSERT on `running_orders`, not UPDATE on `segments`

### What We Give Up
- Storage efficiency (each version duplicates all segments)
- Query complexity for "get latest" (need `ORDER BY version DESC LIMIT 1`)
- Potential for large table growth in long sessions

### Mitigation
- For MVP, sessions last 30-60 minutes with at most ~20 version changes — negligible storage
- Index on `(session_id, version DESC)` keeps queries fast
- Post-session cleanup can archive old versions

---

## Decision 7: Monorepo Structure

### Decision
Use a monorepo (`sudriv/`) with separate directories for frontend (`apps/web`), agent (`apps/agent`), and shared packages (`packages/`).

### Rationale
1. **Shared types**: TypeScript types for the database schema are shared between frontend and (via generation) the agent
2. **Atomic changes**: A running order schema change can update the DB migration, frontend types, and agent code in a single commit
3. **Simplified CI/CD**: One repository to manage, one set of secrets
4. **Discoverability**: New engineers see the full system in one place

### What We Give Up
- Independent deployment cycles (frontend and agent are loosely coupled anyway)
- Language-specific tooling optimization (Python agent + TypeScript frontend in same repo)

### Structure

```
sudriv/
├── apps/
│   ├── web/          # Next.js (TypeScript)
│   └── agent/        # LiveKit Agent (Python)
├── packages/
│   ├── shared/       # Shared constants and utilities
│   ├── database/     # Supabase migrations, types, seed data
│   └── ui/           # Shared shadcn/ui components
├── knowledge-base/   # This documentation
├── .github/          # CI/CD workflows
├── package.json      # Root workspace config
└── turbo.json        # Turborepo config (optional)
```

---

## Decision 8: Single Pending Proposal Constraint

### Decision
Only one proposal can be pending at a time per session. Creating a new proposal auto-expires the previous one.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Single pending (chosen)** | Simple mental model, clear state machine | Can't queue multiple proposals |
| Queue of proposals | Batch operations | Complex state, producer confusion |
| No formal proposals | Simpler code | No audit trail, no safety guardrails |

### Rationale
In live TV, the producer makes one decision at a time. Queuing multiple proposals would create confusion ("Wait, which change are we talking about?"). The single-proposal constraint matches the natural cadence of a voice conversation: one topic at a time.

### What We Give Up
- Ability to batch multiple changes into one proposal (producer must confirm each individually)
- Background proposal preparation while discussing another topic

---

## Decision 9: Agent-Side Validation vs. Database Constraints

### Decision
Validate running order invariants in the agent's Python code before writing to the database, rather than relying solely on database constraints.

### Rationale
1. **Better error messages**: The agent can explain the problem to the producer in natural language ("I can't do that because it would create a gap in the timeline")
2. **Faster feedback**: Validation happens before the write, avoiding a round-trip to Supabase
3. **Defense in depth**: Database constraints are still present as a safety net

### Validation Layers

```
Layer 1: Agent-side validation (Python)
    ├── Contiguous positions
    ├── Correct offset calculations
    ├── Positive durations
    ├── Total duration consistency
    └── No duplicate positions

Layer 2: Database constraints (Postgres)
    ├── CHECK constraints on enums and positive values
    ├── UNIQUE constraints on positions within a running order
    ├── Foreign key constraints
    └── NOT NULL constraints
```

---

## Decision 10: No Real-time News Ingestion for MVP

### Decision
Use pre-loaded news items instead of real-time news ingestion.

### Rationale
Real-time news ingestion introduces:
1. **Legal complexity**: Scraping news sites has legal implications
2. **Reliability risk**: External APIs can fail, rate-limit, or change
3. **Content quality**: Unvetted content could contain errors or inappropriate material
4. **Complexity**: RSS parsing, deduplication, summarization, priority classification
5. **Distraction**: It's not the core value proposition — voice-controlled timeline management is

Pre-loaded items are:
- Deterministic (reproducible demos)
- High quality (hand-crafted teleprompter text)
- Sufficient to demonstrate all agent capabilities
- Zero external dependency risk

### Migration Path (Post-MVP)
When adding live ingestion, the architecture supports it naturally:
1. A separate ingestion service writes to the `news_items` table
2. The agent already queries `news_items` — it will see new items automatically
3. Priority classification can be done by a separate LLM call during ingestion
4. The agent's proactive alerting logic already handles new high-priority items
