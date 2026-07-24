# Sudriv Technical Architecture & Deep Dive

This document provides a comprehensive, deep-technical overview of the Sudriv platform. It covers the end-to-end architecture, the realtime Voice AI pipeline, state synchronization, and the exact flow of data through the system.

---

## 1. High-Level Architecture

Sudriv is a realtime, multi-modal control room application. It pairs a Next.js frontend with a Python-based Voice AI Agent to manage live news broadcasting timelines.

### Core Stack
- **Frontend**: Next.js 15 (App Router), React, TailwindCSS, shadcn/ui.
- **Agent Backend**: Python 3.11, `livekit-agents` framework, `livekit-plugins-openai` / `deepgram` / `elevenlabs`.
- **Realtime Infrastructure**: LiveKit Cloud (WebRTC routing), Supabase Realtime (Postgres CDC WebSockets).
- **Database**: Supabase (Postgres), Redis (Upstash) for distributed locking.
- **AI Models**:
  - **STT (Speech-to-Text)**: Deepgram Nova-2 (streaming).
  - **LLM (Reasoning)**: OpenAI GPT-4o / GPT-4o-mini.
  - **TTS (Text-to-Speech)**: ElevenLabs (streaming).
  - **VAD (Voice Activity Detection)**: Silero VAD (local edge inference).

### System Topology
1. The **Producer (User)** interacts with the Next.js Frontend.
2. The Frontend connects to **LiveKit Cloud** via WebRTC.
3. LiveKit Cloud dispatches the connection to the **Python Agent Worker**.
4. Both the Frontend and the Agent maintain persistent WebSocket connections to **Supabase Realtime** to stay in perfect sync without polling.

---

## 2. Voice AI Pipeline

The voice pipeline operates as a continuous, asynchronous stream handled by the `livekit.agents` framework.

### The Flow
1. **Audio Ingress**: The producer speaks into their microphone. Audio frames are routed via WebRTC to the Python worker.
2. **STT (Deepgram)**: Incoming audio chunks are streamed to Deepgram. Deepgram emits intermediate text (is_final=False) and final text (is_final=True).
3. **ChatContext**: Finalized speech is appended to the agent's `ChatContext` as a User message.
4. **LLM Inference**: The framework triggers the LLM (OpenAI) with the updated `ChatContext`. 
   - *Note*: Before inference, Sudriv dynamically updates the System Prompt (via `get_focus_context`) to inject the absolute latest state (timeline, available news).
5. **TTS Generation**: As the LLM streams text tokens back, they are buffered into sentences and streamed directly to ElevenLabs.
6. **Audio Egress**: ElevenLabs returns PCM audio bytes, which the agent pushes back over WebRTC to the user's speaker.

### Interruption & Barge-In
Interruption is managed locally on the worker using **Silero VAD**.
- **Detection**: VAD constantly monitors incoming user audio. If it detects human speech (`min_silence_duration` is tuned to `0.7s` to prevent false positives from breathing/pausing), it triggers an interruption event.
- **Cancellation**: The framework instantly aborts the active LLM generation task and halts the ElevenLabs TTS stream.
- **Context Truncation**: Crucially, the framework calculates exactly how many words were spoken by the TTS *before* the interruption. It rewrites the Assistant's message in the `ChatContext` to end exactly where it was cut off (e.g., `["I am going to add the..."]`), ensuring the LLM knows exactly what the user heard before they barged in.

### Tool Calling
The LLM has access to tools (functions). If the LLM decides to emit a tool call instead of text:
1. The framework halts TTS (since there is no text yet).
2. The framework invokes the Python method (e.g., `propose_timeline_update`).
3. The method returns a string result.
4. The result is appended to the `ChatContext` as a `tool_response`.
5. The LLM is automatically re-prompted to interpret the tool response and speak to the user.

---

## 3. Session Lifecycle

The lifecycle of an active broadcast session:

1. **Initialization (Frontend)**: 
   - A POST request to `/api/session` creates a unique `session_id` and LiveKit `room_name`.
   - It clones a default timeline template into Supabase (`running_orders` and `segments` tables).
2. **Connection**: 
   - Frontend joins the LiveKit room.
   - LiveKit Webhook wakes up the Python worker (`main.py`).
   - `pre_authenticate` validates the connection.
   - `entrypoint` initializes the `AgentSession` object.
3. **Agent Bootup**:
   - The agent fetches the initial state from Supabase (`reload_from_db`).
   - It fires up an `asyncio.Task` to listen to Supabase Realtime (`start_realtime_sync`).
   - It connects the Voice Pipeline to the room and greets the user.
4. **Teardown**:
   - When the user closes the tab or leaves the room, LiveKit emits a disconnect event.
   - The Python framework cancels all async tasks.
   - The agent worker gracefully exits, releasing memory.

---

## 4. Data Storage & Formats

### Supabase (Postgres)
- `sessions`: Tracks overall session state (active, ended).
- `running_orders`: Versioned snapshots of the timeline. (Columns: `id`, `session_id`, `version`, `total_duration_seconds`).
- `segments`: Individual rows for timeline items tied to a `running_order_id`. Must remain contiguous in `position`.
- `news_items`: Available news articles. (Columns: `id`, `headline`, `content`, `priority`, `is_used`).
- `proposals`: Tracks agent-proposed changes pending user confirmation.

### Redis (Distributed State)
Used exclusively for **Distributed Locking**.
- Key: `session:{session_id}:lock`
- Purpose: Prevents race conditions. If the agent tries to apply a timeline update at the exact same millisecond the user clicks a button on the UI, Redis ensures only one operation mutates the `running_order` version at a time.

### In-Memory (Agent State)
The agent caches the DB state in memory to respond instantly without querying DB on every word:
- `self.session.running_order`: A dictionary mirroring the current timeline.
- `self.session.available_news_items`: A list of unused news.
These are updated in microseconds via the Supabase Realtime WebSocket callback.

---

## 5. Timeline Update Flow (Propose → Confirm → Apply)

Because timeline changes are destructive, Sudriv uses a strict confirmation flow.

### Step 1: Propose (`propose_timeline_update`)
1. The LLM decides to insert a segment.
2. The tool calculates the theoretical impact without mutating anything (`_calculate_impact`).
3. **Fail-Fast Validation**: The tool validates structural invariants (e.g., no gap in positions, valid durations). It also resolves the `news_item_id`.
4. If validation fails, it throws a strict `ValueError` instructing the LLM to silently correct its parameters without bothering the user.
5. If valid, the proposal is cached in `ConfirmationGuard` and the tool returns a string instructing the LLM to ask: "कर दूँ?" (Shall I do it?).

### Step 2: Confirmation Guard
- The agent waits for user audio. 
- If the user says "yes" (हाँ), the LLM calls `apply_timeline_update`.
- If the user says "no", the LLM calls `cancel_timeline_update`.
- If the user changes the subject, the `ConfirmationGuard` intercepts the state, gracefully cancels the pending proposal, and handles the new subject.

### Step 3: Apply (`apply_timeline_update`)
1. Acquires Redis lock (`set nx=True`).
2. Calculates the final state.
3. Validates invariants one last time.
4. Executes a batch Postgres transaction (writes new `running_order` and new `segments`).
5. Marks the associated `news_item` as `is_used = True`.
6. Generates a dynamic Hindi anchor script via OpenAI (`_auto_anchor_after_apply`) and saves it as `teleprompter_text`.
7. Releases Redis lock.

---

## 6. News Items Context Injection

A classic problem with LLMs is hallucinating UUIDs (e.g., inventing `news_item_id = "earthquake-123"`). 

Sudriv solves this via **Dynamic Context Injection**:
1. In `session.py`, `get_focus_context()` dynamically builds the System Prompt immediately before the LLM speaks.
2. It fetches the in-memory `available_news_items`.
3. It formats them with an 8-character ID prefix: `[ID: e8202b] [high] Earthquake strikes...`
4. When calling `propose_timeline_update`, the LLM naturally passes the exact `e8202b` prefix.
5. The tool resolves this prefix back to the full UUID (`[n for n in items if n['id'].startswith(prefix)]`), completely eliminating ID hallucinations.

---

## 7. Frontend ↔ Backend Communication

Sudriv achieves a "magic" feeling of perfect synchronization without API polling.

- **Frontend → Backend**: WebRTC audio stream, and direct Supabase database mutations via UI clicks.
- **Backend → Frontend**: The Python agent writes to Supabase. Supabase Realtime pushes PostgreSQL Change Data Capture (CDC) events to the Next.js `useEffect` hooks in milliseconds. When the agent applies a timeline change, the React UI updates instantly.
- **Backend ↔ Backend**: If the React UI updates the timeline, Supabase Realtime pushes that change to the Python agent's async WebSocket listener, which updates the agent's in-memory `running_order`. The agent's next sentence will instantly reflect the user's manual UI changes.

---

## 8. Key Files Map

### Agent (Python)
- `apps/agent/main.py`: The entrypoint. Configures Silero VAD, connects to LiveKit, defines agent startup logic.
- `apps/agent/agent/session.py`: The heart of state management. Houses `SessionManager`, builds the dynamic LLM context (`get_focus_context`), and runs the `start_realtime_sync` websocket listener.
- `apps/agent/agent/tools.py`: Houses `SudrivToolkit`. Contains all the LLM-callable functions, the invariant validation engine, and the OpenAI dynamic script generator.
- `apps/agent/agent/prompts.py`: Defines the core system instructions and personality of the AI Producer.

### Web (Next.js)
- `apps/web/app/(dashboard)/session/[id]/page.tsx`: The main Control Room view layout.
- `apps/web/components/session/running-order.tsx`: Renders the timeline UI, handles drag-and-drop, and subscribes to Supabase Realtime updates.
- `apps/web/lib/supabase/middleware.ts`: Next.js Auth Guard. Protects routes, handles token refresh, and securely injects `x-user-id` headers into downstream API routes to prevent cookie mismatch bugs.
- `apps/web/app/api/session/route.ts`: Initializes new sessions and provisions default database state securely.

---

## 9. Current Strengths & Remaining Limitations

### Engineering Strengths
1. **Bulletproof Validation**: The invariant engine (`_validate_running_order`) guarantees that the LLM can never corrupt the database state (e.g., position gaps, negative durations).
2. **Context Injection**: By providing tight, prefix-based IDs in the dynamic prompt, it forces a non-deterministic LLM to behave deterministically when referencing foreign keys.
3. **Locking & Sync**: The Redis lock + Supabase Realtime architecture completely eliminates race conditions between the AI and the human operator.

### Current Limitations & Future Work
1. **Context Window Saturation**: If the news wire pulls in 500 articles, injecting all of them into the system prompt will consume massive tokens and increase latency.
   * *Future Fix*: Implement a RAG (Retrieval-Augmented Generation) layer or a `search_news` tool, rather than dumping all news into the prompt.
2. **TTS Latency (TTFB)**: While ElevenLabs streaming is fast, there is still a ~300-500ms Time-To-First-Byte delay.
   * *Future Fix*: Transition to OpenAI's native Realtime API (WebRTC audio-in to audio-out) to drop latency to ~150ms, bypassing separate STT and TTS hops.
3. **Complex State Machine**: Keeping Redis, Supabase, and local Agent memory in perfect sync is complex and slightly fragile if network partitions occur.
   * *Future Fix*: Rely more on LiveKit Room metadata / DataChannels for ephemeral state sync rather than bouncing everything through Postgres CDC.
