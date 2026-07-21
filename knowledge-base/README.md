# Sudriv Knowledge Base

> **Sudriv** turns live breaking news chaos into smooth, voice-controlled timeline updates and clean instructions for the anchor.

This knowledge base contains everything required to build Sudriv end-to-end. It is designed for senior engineers and covers architecture, data models, voice pipeline design, frontend/backend systems, and implementation details.

---

## Documents

| # | Document | Description |
|---|----------|-------------|
| 00 | [Project Overview](./00-project-overview.md) | Problem statement, solution, target users, design principles |
| 01 | [Product Vision & Goals](./01-product-vision-and-goals.md) | Strategic goals, product principles, success metrics, non-goals |
| 02 | [User Flows (MVP)](./02-user-flows-mvp.md) | Complete user flows from login to session end, voice interaction patterns |
| 03 | [System Architecture](./03-system-architecture.md) | Component breakdown, data flow, latency budget, failure modes, deployment |
| 04 | [Data Models](./04-data-models.md) | Postgres schema, Redis structures, consistency rules, seed data spec |
| 05 | [Voice Agent Design](./05-voice-agent-design.md) | Agent architecture, system prompt, session manager, confirmation guard |
| 06 | [Tools & Function Calling](./06-tools-and-function-calling.md) | All 5 tools with implementation, safety rules, sequence diagrams |
| 07 | [Frontend Architecture](./07-frontend-architecture.md) | Next.js structure, layouts, components, realtime subscriptions, LiveKit |
| 08 | [Backend & Realtime](./08-backend-and-realtime.md) | API routes, Supabase Realtime, RLS policies, Redis integration, auth |
| 09 | [Language & Voice Pipeline](./09-language-and-voice-pipeline.md) | STT, LLM, TTS, VAD, Hinglish handling, latency optimization |
| 10 | [MVP Scope & Demo Mode](./10-mvp-scope-and-demo-mode.md) | What's in/out of scope, complete seed data with teleprompter text |
| 11 | [Technical Decisions & Tradeoffs](./11-technical-decisions-and-tradeoffs.md) | 10 key decisions with alternatives, rationale, and migration paths |
| 12 | [Future Roadmap](./12-future-roadmap.md) | 4-phase roadmap, feature details, tech debt backlog, success criteria |

---

## Quick Reference

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind, shadcn/ui, @dnd-kit, Framer Motion |
| Voice Agent | LiveKit Agents SDK (Python), Sarvam STT/TTS, Groq Llama 3.3 70B |
| Database | Supabase (Postgres + Realtime + Auth) |
| Cache | Redis (Upstash) |
| Deployment | Vercel (frontend), LiveKit Cloud (agent), Supabase Cloud, Upstash |

### Core Agent Tools

1. `get_current_running_order` — Read current state
2. `analyze_impact` — Calculate cascading effects
3. `propose_timeline_update` — Create formal proposal
4. `apply_timeline_update` — Apply after confirmation only
5. `push_anchor_instruction` — Send clean instruction to anchor

### Critical Workflow

```
Read → Analyze → Propose → Wait for Confirmation → Apply
```

**The AI never modifies the running order without explicit producer confirmation.**
