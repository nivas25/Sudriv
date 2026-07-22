# Design Decisions — Sudriv

Short, judge-friendly record of important technical choices.  
Longer product context: `knowledge-base/`.

---

## 1. LiveKit Agents over custom WebRTC

**Decision:** Use LiveKit Cloud + Agents SDK 1.6 for rooms, job dispatch, RoomIO, and voice session orchestration.

**Why:** Building reliable WebRTC, TURN, VAD, and interruption from scratch is months of work. LiveKit provides production media + an agent worker model.

**Tradeoff:** Platform dependency; mitigated by keeping tools/session logic in our Python package.

---

## 2. Chained STT → LLM → TTS (not one realtime model)

**Decision:** Sarvam STT + OpenAI chat LLM + Sarvam TTS, not OpenAI Realtime / Gemini Live as the sole model.

**Why:**

- Explicit tool calling for editorial safety  
- Swap STT/TTS for Indian languages (Sarvam) independently of LLM  
- Easier debugging of each stage  

**Tradeoff:** Slightly more pipeline glue; better control for a newsroom product.

---

## 3. Human confirmation before mutations

**Decision:** `propose_timeline_update` + `ConfirmationGuard` before `apply_timeline_update`.

**Why:** Live TV cannot allow silent AI edits to the running order.

---

## 4. Push-to-talk by default

**Decision:** Mic off until press-and-hold.

**Why:** Continuous open mic produced false STT finals and random agent replies in a noisy PCR-like environment.

---

## 5. VAD interruption without waiting for words

**Decision:** Interruption `mode=vad`, `min_words=0`, low `min_duration`.

**Why:** Requiring STT words (`min_words=1`) added ~1–2s lag before barge-in. With PTT, false barge-ins are rare.

---

## 6. Service-role API for timeline reads

**Decision:** `GET /api/session/[id]/running-order` uses service role after auth ownership check; UI polls + Refresh.

**Why:** Browser client hit RLS empty reads while agent wrote with service role. Polling is reliable for hackathon/demo; Realtime can be layered later.

---

## 7. Compact LLM focus window

**Decision:** System prompt includes NOW + next slots + top news only; full RO via tools.

**Why:** Keeps token usage and latency down; avoids dumping entire catalogs every turn.

---

## 8. Hindi-primary voice stack (current product config)

**Decision:** STT `hi-IN`, TTS `hi-IN` / speaker `priya`, Hindi system prompt.

**Why:** Target demo language for Indian newsroom producers. EN/Hinglish multi-mode remains a future switch, not the default.

---

## 9. Split deploy: Vercel + Railway

**Decision:** Next.js on Vercel; long-running agent worker on Railway Docker.

**Why:** Serverless is ideal for UI/API; LiveKit agents need a persistent process registered with LiveKit Cloud.

---

## 10. OpenAI `gpt-4o-mini` for conversation

**Decision:** Single primary LLM for dialogue + tools (not Groq 70B on the hot path).

**Why:** Stable tool calling, predictable latency/cost, avoids TPM issues seen with large Groq models in development.
