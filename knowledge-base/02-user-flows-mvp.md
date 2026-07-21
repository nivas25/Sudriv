# 02 — User Flows (MVP)

## Flow Overview

The MVP has a single linear flow with one actor (Producer) and one AI entity (Voice Agent). All interactions happen through voice as the primary channel, with the screen providing visual feedback and confirmation.

---

## Flow 1: Authentication

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Login Page  │────▶│  Validate    │────▶│  Dashboard   │
│              │     │  Credentials │     │  (Setup)     │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Steps
1. Producer navigates to `app.sudriv.com`
2. Login page loads with email + password fields
3. Producer enters fixed MVP credentials:
   - Email: `producer@sudriv.demo`
   - Password: `sudriv-demo-2025`
4. System validates against Supabase Auth (single pre-configured user)
5. On success → redirect to Setup / Dashboard screen
6. On failure → show error, allow retry

### Edge Cases
- **Session persistence**: If a valid session exists, skip login and go directly to Dashboard
- **Session expiry**: Redirect to login with a clear message
- **Multiple tabs**: Only one active session allowed. Second tab shows "Session active in another tab"

---

## Flow 2: Session Setup

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Dashboard  │────▶│  Select Timeline │────▶│  Start Session │
│              │     │  + News Category │     │                │
└──────────────┘     └──────────────────┘     └────────────────┘
```

### Steps
1. Dashboard shows:
   - Available pre-loaded timelines (Running Orders)
   - Optional: News category filter (General, Politics, Sports, etc.)
   - "Start Session" button (disabled until timeline is selected)
2. Producer selects a timeline from the list
3. (Optional) Producer selects a news category to filter pre-loaded news items
4. Producer clicks **Start Session**
5. System:
   - Loads the selected Running Order into hot state (Redis)
   - Loads filtered news items into the agent's context
   - Creates a new session record in Supabase
   - Initializes the LiveKit room
   - Connects the Voice Agent to the room

### Pre-loaded Timelines (MVP Demo Data)

| Timeline | Duration | Segments | Description |
|----------|----------|----------|-------------|
| Morning Bulletin | 30 min | 8 | Standard morning news with weather, sports |
| Breaking News: Earthquake | 45 min | 6 | Developing earthquake story with live updates |
| Election Night Special | 60 min | 12 | Election results coverage with multiple segments |
| Evening Prime | 30 min | 10 | Standard evening prime-time news |

### Pre-loaded News Items (MVP Demo Data)

Each news item contains:
- `id`: Unique identifier
- `headline`: Short headline
- `summary`: 2-3 sentence summary
- `category`: News category
- `priority`: `critical` | `high` | `medium` | `low`
- `estimated_duration`: Suggested segment duration in seconds
- `source`: News source attribution
- `content`: Full teleprompter-ready text
- `created_at`: Timestamp

---

## Flow 3: Active Session — Voice Interaction

This is the core flow. The session is now live, and the Producer interacts with the AI through voice.

### 3a: Agent Greeting

```
Agent → Producer:
"Good morning! I'm your Sudriv co-pilot. I've loaded the Morning Bulletin 
running order with 8 segments, total duration 30 minutes. I also have 15 
news items ready across General and Politics categories. 
How would you like to begin?"
```

The greeting includes:
- Confirmation of which timeline is loaded
- Segment count and total duration
- Available news items summary
- Open-ended prompt for the producer

### 3b: Proactive News Alert

When the agent identifies a high-priority news item that may warrant inclusion:

```
Agent → Producer:
"I have a critical update. A 6.2 magnitude earthquake has been reported 
in Gujarat. I have a full story ready — estimated 3 minutes. Would you 
like me to analyze where this fits in the running order?"
```

The producer can:
- **Accept**: "Yes, show me the impact"
- **Reject**: "Not now, we'll cover it later"
- **Ask for more info**: "What's the source? How old is this?"
- **Interrupt**: Start speaking at any point → Agent stops immediately

### 3c: Impact Analysis & Proposal

When the producer asks to include a new item or modify the running order:

```
Agent → Producer:
"Here's my proposal. I recommend inserting the earthquake story as segment 3, 
right after the government policy update. Here's the impact:

- Segment 3 (Sports Roundup) moves to slot 4, starts at 14:22 instead of 14:17
- Segment 4 (Weather) moves to slot 5, starts at 14:27 instead of 14:22
- Total show duration increases from 30 minutes to 33 minutes
- The closing segment will need to be shortened by 3 minutes, or we drop 
  the lifestyle segment entirely

Should I apply this change?"
```

The screen simultaneously shows:
- Visual diff of the running order (before → after)
- Highlighted timing changes
- Total duration impact
- Segments affected (color-coded)

### 3d: Confirmation

The producer has three options:

| Response | Action |
|----------|--------|
| **Confirm** ("Yes, apply it" / "Go ahead" / "Do it") | Agent applies the change immediately |
| **Reject** ("No, cancel" / "Never mind" / "Skip it") | Agent discards the proposal, running order unchanged |
| **Modify** ("Make it slot 4 instead" / "Keep the lifestyle segment, cut weather") | Agent recalculates with the modification and presents a new proposal |

### 3e: Apply & Propagate

On confirmation:

```
Agent → Producer:
"Done. Earthquake story is now segment 3. Timeline updated. 
Teleprompter is synced. I've prepared the anchor instruction: 
'After the policy story, we're going straight to the earthquake 
in Gujarat. Full script is loaded on prompter.'"
```

Simultaneous system actions:
1. Running order updated in Redis (hot state) → immediate
2. Running order persisted to Supabase → within 500ms
3. Frontend timeline view updates via Supabase Realtime → within 500ms
4. Teleprompter text updated → within 500ms
5. Anchor instruction generated and displayed → within 1 second

---

## Flow 4: Manual Override

The producer can always make manual changes via the UI:
1. Drag-and-drop segments in the timeline
2. Click to edit segment details
3. Add/remove segments manually
4. All manual changes sync back to the agent's context

Manual changes trigger the agent to acknowledge:
```
Agent → Producer:
"I see you've moved the weather segment to slot 2. I've updated my 
running order accordingly. Current total duration is 31 minutes."
```

---

## Flow 5: Session End

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Producer     │────▶│  Confirm End     │────▶│  Session       │
│  "End session"│     │  Session Modal   │     │  Summary       │
└──────────────┘     └──────────────────┘     └────────────────┘
```

### Steps
1. Producer says "End session" or clicks the End Session button
2. Confirmation modal appears: "Are you sure you want to end this session?"
3. On confirm:
   - Voice agent says goodbye and disconnects
   - LiveKit room is closed
   - Session state is finalized in Supabase
   - Redis hot state is cleared
   - Session summary is generated and displayed
4. Producer is returned to the Dashboard

### Session Summary Includes
- Total session duration
- Number of running order changes made
- Number of news items discussed
- Number of anchor instructions generated
- Final running order state (exportable)

---

## Flow Diagram (Complete MVP)

```
Login ──▶ Dashboard ──▶ Select Timeline ──▶ Start Session
                                                  │
                                                  ▼
                                          ┌───────────────┐
                                          │  Active Voice  │◀──┐
                                          │   Session      │   │
                                          └───────┬───────┘   │
                                                  │            │
                                    ┌─────────────┼────────────┤
                                    ▼             ▼            │
                              Agent Alert    Producer      Modify &
                              (new info)     Request        Repeat
                                    │             │            │
                                    ▼             ▼            │
                              ┌───────────────────────┐       │
                              │   Impact Analysis +   │       │
                              │   Proposal            │       │
                              └───────────┬───────────┘       │
                                          │                    │
                              ┌───────────┼──────────┐        │
                              ▼           ▼          ▼        │
                           Confirm     Reject     Modify ─────┘
                              │           │
                              ▼           ▼
                        Apply Change   Discard
                              │
                     ┌────────┼────────┐
                     ▼        ▼        ▼
                  Update   Update   Generate
                  Timeline  Prompt  Anchor Instr.
                              │
                              ▼
                        End Session ──▶ Summary ──▶ Dashboard
```

---

## Voice Interaction Patterns

### Natural Language Understanding

The system must understand varied phrasings for the same intent:

| Intent | Example Phrases |
|--------|----------------|
| Confirm | "Yes", "Go ahead", "Apply it", "Do it", "Confirmed", "हाँ करो", "Theek hai" |
| Reject | "No", "Cancel", "Don't do that", "Skip it", "Nahi", "Rehne do" |
| Modify | "Make it slot 4 instead", "Can we keep sports?", "Slot 2 mein daal do" |
| Ask for info | "What's the source?", "How long is this story?", "Kitna time lagega?" |
| End session | "End session", "We're done", "Wrap it up", "Band karo" |

### Interruption Handling

The system uses LiveKit's adaptive interruption handling:

1. **Producer starts speaking** → Agent immediately stops talking
2. **Short interruption** (< 1 second, like "hmm") → Agent pauses briefly, then continues
3. **Full interruption** (> 1 second with clear intent) → Agent stops and listens
4. **Rapid back-and-forth** → Agent adjusts to conversational rhythm

### Error Recovery

| Scenario | Agent Response |
|----------|---------------|
| STT doesn't understand | "I didn't catch that. Could you repeat?" |
| Ambiguous command | "Just to clarify — did you want to move the earthquake story to slot 3 or replace slot 3 with it?" |
| Invalid action | "I can't remove segment 1 because it's currently on air. Would you like to shorten it instead?" |
| System error | "I'm having a technical issue updating the timeline. Your running order is safe. Let me try again." |
