# 01 — Product Vision & Goals

## Vision Statement

Sudriv will become the standard operating co-pilot for live news production — a system that understands the rhythm of a live broadcast, anticipates the producer's needs, and executes changes with the speed and precision that live television demands.

---

## Strategic Goals

### Short-Term (MVP / PoC)
1. **Prove the voice-first workflow** — Demonstrate that a producer can manage a running order entirely through natural voice conversation with an AI co-pilot
2. **Prove real-time reliability** — Show that timeline updates propagate to teleprompter and anchor instructions within sub-second latency
3. **Prove the confirmation pattern** — Validate that the Read → Analyze → Propose → Confirm → Apply cycle works under simulated breaking news pressure
4. **Prove multilingual capability** — Demonstrate fluid English / Hindi / Hinglish interaction without mode switching

### Medium-Term (Post-MVP)
1. **Live news ingestion** — Integrate real-time trusted news sources (wire services, RSS, curated feeds)
2. **Multi-session support** — Multiple producers running concurrent sessions
3. **Anchor-side integration** — Real IFB audio delivery, production-grade teleprompter integration
4. **Analytics dashboard** — Session replay, decision audit trail, performance metrics
5. **Role-based access** — Producer, Director, Technical Director roles with appropriate permissions

### Long-Term
1. **Predictive intelligence** — AI proactively suggests running order adjustments based on developing stories
2. **Cross-show coordination** — Manage handoffs between shows (e.g., breaking news extending into the next hour)
3. **Training mode** — Junior producers train with simulated breaking news scenarios
4. **Newsroom ecosystem integration** — ENPS, iNews, Octopus, and other NRCS (Newsroom Computer Systems) integration

---

## Product Principles

### 1. Speed Over Polish
In live news, a correct decision delivered 2 seconds late is worse than an imperfect decision delivered instantly. Every architectural and UX decision must optimize for latency first.

### 2. Clarity Over Cleverness
The AI's communication must be direct, unambiguous, and structured. A producer under pressure cannot parse nuanced language. Instructions must be crisp:
- ✅ "I suggest moving the earthquake story to slot 3. This pushes the sports segment from 14:22 to 14:27, five minutes later. Should I apply this?"
- ❌ "Given the evolving situation, you might want to consider repositioning the earthquake coverage earlier in the broadcast, which could have some downstream timing implications..."

### 3. Trust Through Transparency
Every AI action must be explainable. The producer must see:
- What the AI is proposing
- Why it's proposing it
- What the impact will be on the rest of the timeline
- That nothing will change until they explicitly confirm

### 4. Graceful Failure
The system must never leave the producer worse off than manual operation:
- If voice recognition fails → fall back to manual controls
- If the LLM hallucinates → validation layer catches invalid proposals
- If the connection drops → local state preserves the last known good running order
- If Redis is unavailable → fall back to Supabase directly

### 5. One User, One Voice
The MVP has exactly one active user: the Producer. The system is designed for a single voice stream, a single decision authority, and a single running order at a time. Multi-user support is explicitly deferred.

---

## Success Metrics (MVP)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Voice command → timeline update latency | < 2 seconds end-to-end | Instrumented timestamps at each pipeline stage |
| STT accuracy (English) | > 95% word accuracy | Comparison against manual transcripts |
| STT accuracy (Hindi/Hinglish) | > 90% word accuracy | Comparison against manual transcripts |
| Interruption handling | Producer can interrupt mid-sentence and AI stops gracefully | Manual testing with rapid interruption scenarios |
| Timeline consistency | Zero orphaned or overlapping segments after any update | Automated invariant checks after every mutation |
| Confirmation safety | Zero unconfirmed changes applied | Audit log verification |
| Session stability | 30+ minute session without crash or state corruption | Endurance testing |

---

## Non-Goals (Explicit Exclusions for MVP)

| Non-Goal | Rationale |
|----------|-----------|
| Real-time web scraping | Unreliable, legally complex, unnecessary for PoC |
| Multi-producer sessions | Adds concurrency complexity without proving core value |
| Real IFB audio delivery | Requires hardware integration; simulated text + TTS is sufficient |
| NRCS integration | Vendor-specific, requires partnerships |
| Mobile app | Desktop-first for PCR environment |
| Offline mode | Always-connected assumption is valid for PCR |
| Content generation | AI assists with structure, not with writing news copy |

---

## Competitive Landscape

There is no direct competitor doing voice-first AI co-piloting for live news production. Adjacent solutions include:

| Category | Examples | Gap Sudriv Fills |
|----------|----------|-----------------|
| Newsroom Computer Systems | ENPS, iNews, Octopus | No AI, no voice, no real-time impact analysis |
| AI news tools | Automated Insights, Wibbitz | Focus on content generation, not production control |
| Voice assistants | Alexa, Google Assistant | General purpose, no domain expertise, no timeline management |
| Production automation | Ross OverDrive, Grass Valley Ignite | Hardware automation, not editorial decision support |

Sudriv occupies a unique position: **domain-specific AI co-pilot for the editorial decision layer of live news production**.
