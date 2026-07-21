# 00 — Project Overview

## What is Sudriv?

Sudriv is a real-time AI co-pilot for television news producers. It transforms the high-pressure, manual process of managing live breaking news into a voice-controlled, AI-assisted workflow. The producer speaks naturally, the AI updates the running order (timeline), calculates downstream impact, and generates clean instructions for the live anchor — all in real time.

**One-line summary:** Sudriv turns live breaking news chaos into smooth, voice-controlled timeline updates and clean instructions for the anchor.

---

## The Problem

In a live newsroom during breaking news, the **Producer** (sitting in the Production Control Room) must simultaneously:

| Task | Current State |
|------|--------------|
| Receive new information from multiple sources | Manual monitoring of feeds, wires, field reporters |
| Update the Running Order (segment timeline) | Manual spreadsheet / rundown software edits |
| Calculate cascading impact of every change | Mental arithmetic under extreme time pressure |
| Communicate updates to the live Anchor via IFB earpiece | Verbal, unstructured, error-prone |
| Keep teleprompter synchronized | Separate system, manual updates |
| Make editorial decisions in seconds | No decision-support tooling |

This process is:
- **Fragmented** — 4+ disconnected tools and communication channels
- **Manual** — every calculation and update is done by hand
- **High-stress** — one mistake on live TV is irreversible
- **Error-prone** — cognitive overload leads to missed cues and timing errors

---

## The Solution

Sudriv is an intelligent voice-first co-pilot that sits exclusively with the **Producer** (never directly with the live Anchor).

### Core Workflow

```
New Info Available
       │
       ▼
AI Notifies Producer (voice)
       │
       ▼
Natural Voice Discussion
(Producer can interrupt anytime)
       │
       ▼
AI Proposes Running Order Update
+ Impact Analysis
       │
       ▼
Producer Confirms / Rejects / Modifies (voice)
       │
       ▼
Timeline Updates Immediately
       │
       ▼
Teleprompter Updates Immediately
       │
       ▼
Clean Anchor Instruction Generated
```

### Key Characteristics

- **Voice-first**: The producer's hands are busy. Voice is the primary interface.
- **AI-assisted, human-controlled**: The AI proposes, the producer decides. No autonomous changes.
- **Real-time**: Sub-second latency from decision to timeline update.
- **Context-aware**: The AI understands the full running order, timing constraints, and editorial priorities.
- **Multilingual**: Native support for English, Hindi, and natural Hinglish code-switching.

---

## Target Users

### Primary User: The Producer
- Sits in the Production Control Room (PCR)
- Has direct interaction with Sudriv via voice
- Makes all editorial and timing decisions
- Has full control — AI never acts without explicit confirmation

### Secondary Beneficiary: The Anchor
- Is live on air — cannot interact with the AI
- Receives clean, formatted instructions via:
  - Updated teleprompter text
  - Simulated IFB instruction (text + synthesized voice in future iterations)
- Never sees the AI's internal reasoning or impact analysis

---

## Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Producer-only interaction** | The anchor is live — any direct AI interaction would be disruptive and dangerous |
| **Human-in-the-loop always** | Live TV has zero tolerance for AI mistakes. Every change requires explicit confirmation |
| **Ultra-low latency** | Breaking news moves in seconds. A 3-second delay is unacceptable |
| **No hallucinated changes** | The AI must never fabricate timeline entries or modify the running order without confirmation |
| **Voice-first, screen-second** | The producer's primary interaction is voice; the screen provides visual confirmation and overview |
| **Graceful degradation** | If the AI fails, the producer must be able to continue manually without data loss |

---

## Current Phase: MVP

The current focus is a strong Proof of Concept / MVP with:
- Single pre-configured login
- Demo mode with pre-loaded data
- Full voice conversation with interruption support
- Complete propose → confirm → apply cycle
- Real-time timeline and teleprompter updates
- Simulated anchor instruction generation

See [02-user-flows-mvp.md](./02-user-flows-mvp.md) and [10-mvp-scope-and-demo-mode.md](./10-mvp-scope-and-demo-mode.md) for detailed MVP specifications.

---

## Repository Structure

```
sudriv/
├── apps/
│   ├── web/              # Next.js 15 Frontend
│   └── agent/            # LiveKit Agents (Python)
├── packages/
│   ├── shared/           # Shared types, constants, utilities
│   ├── database/         # Supabase client, migrations, types
│   └── ui/               # Shared UI components (shadcn/ui based)
├── knowledge-base/       # This documentation
├── README.md
└── logo.png
```

See [03-system-architecture.md](./03-system-architecture.md) for the full technical architecture.
