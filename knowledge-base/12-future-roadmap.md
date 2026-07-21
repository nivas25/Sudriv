# 12 — Future Roadmap

## Overview

This document outlines the planned evolution of Sudriv beyond the MVP. Each phase builds on the previous one, and each feature is prioritized by impact and feasibility.

---

## Roadmap Phases

```
Phase 1 (Current)     Phase 2              Phase 3              Phase 4
MVP / PoC             Production Ready     Scale & Integrate    Intelligence
─────────────────     ─────────────────    ─────────────────    ─────────────────
✅ Voice co-pilot     Live news ingest     NRCS integration     Predictive AI
✅ Demo mode          Multi-session        Real IFB delivery    Cross-show coord
✅ Pre-loaded data    Auth + roles         Hardware integration Training mode
✅ Single user        Analytics            Mobile companion     Auto-scheduling
✅ Impact analysis    Session recording    API platform         Content assist
✅ Confirm workflow   Error resilience     Multi-language+      Sentiment aware
```

---

## Phase 2: Production Ready

**Goal**: Transform the MVP into a system that can be used in actual newsroom pilot programs.  
**Timeline**: 2-3 months after MVP validation

### 2.1 Live News Ingestion

**Priority**: High  
**Complexity**: Medium

Replace pre-loaded news items with real-time ingestion from trusted sources.

**Architecture:**
```
┌────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  RSS Feeds     │────▶│  Ingestion       │────▶│  news_items  │
│  Wire Services │     │  Service         │     │  table       │
│  API Partners  │     │  (Python worker) │     │              │
└────────────────┘     └────────┬─────────┘     └──────────────┘
                                │
                       ┌────────▼─────────┐
                       │  LLM Classifier  │
                       │  (priority,      │
                       │   category,      │
                       │   summary)       │
                       └──────────────────┘
```

**Trusted source categories:**
- Wire services: PTI, ANI, Reuters, AP
- RSS feeds from major news outlets (with permission)
- Official government press releases
- Weather/disaster feeds: IMD, NDRF
- Sports: ESPN Cricinfo API, official federation feeds

**Key challenges:**
- Deduplication (same story from multiple sources)
- Priority classification accuracy
- Rate limiting and quota management
- Content licensing and attribution

### 2.2 Multi-Session Support

**Priority**: High  
**Complexity**: High

Support multiple producers running concurrent sessions.

**Changes required:**
- Replace single-user assumption with proper user management
- Room-per-session isolation in LiveKit
- Per-session Redis namespacing (already designed)
- Concurrent session limits and resource management

### 2.3 Authentication & Role-Based Access

**Priority**: High  
**Complexity**: Medium

| Role | Permissions |
|------|------------|
| **Admin** | Manage users, view all sessions, configure system |
| **Producer** | Full session control, voice interaction, timeline management |
| **Director** | View session, approve major changes, override producer |
| **Observer** | Read-only view of active session |

### 2.4 Analytics Dashboard

**Priority**: Medium  
**Complexity**: Medium

**Metrics to track:**
- Average response latency (voice round-trip)
- STT accuracy rates by language
- Proposal acceptance/rejection ratios
- Timeline changes per session
- Session duration trends
- Most common change types (insert > reorder > modify > remove)
- Peak usage hours

**Implementation:**
- Aggregate `session_events` data
- Use Supabase views or materialized views for performance
- Build a separate analytics page in the frontend

### 2.5 Session Recording & Replay

**Priority**: Medium  
**Complexity**: Medium

Record entire sessions for training, audit, and review.

**What to record:**
- Full voice transcript (both producer and agent)
- All tool calls and their results
- Running order state at each version
- Timing of every action
- Producer decisions (confirm/reject/modify)

**Storage:**
- Transcripts and events: Supabase (JSON in `session_events`)
- Audio recordings: Object storage (Supabase Storage or S3)

### 2.6 Error Resilience & Observability

**Priority**: High  
**Complexity**: Medium

- Structured logging with correlation IDs (session → request → tool call)
- Sentry integration for error tracking
- Uptime monitoring for all external services (Groq, Sarvam, LiveKit)
- Automatic fallback chains: Groq → Gemini Flash → GPT-4o-mini
- Circuit breaker pattern for external API calls
- Health check endpoints for all services

---

## Phase 3: Scale & Integrate

**Goal**: Integrate Sudriv into existing newsroom infrastructure and scale to production workloads.  
**Timeline**: 3-6 months after Phase 2

### 3.1 NRCS Integration

**Priority**: High  
**Complexity**: Very High

Integrate with Newsroom Computer Systems:

| NRCS | Protocol | Complexity |
|------|----------|-----------|
| ENPS (AP) | MOS Protocol | High |
| iNews (Avid) | MOS Protocol | High |
| Octopus | REST API | Medium |
| OpenMedia | SOAP/REST | Medium |

**MOS Protocol** (Media Object Server) is the industry standard for newsroom system interoperability. Implementing MOS would allow Sudriv to:
- Read the existing running order from the NRCS
- Push changes back to the NRCS
- Sync with teleprompter systems that read from the NRCS

### 3.2 Real IFB Audio Delivery

**Priority**: High  
**Complexity**: High

Replace the simulated anchor instruction panel with actual IFB audio delivery.

**Options:**
1. **Direct audio**: Route TTS output to a separate audio channel connected to the IFB system
2. **Hardware integration**: Interface with production intercom systems (Riedel, Clear-Com)
3. **IP-based IFB**: Use Dante/AES67 audio networking to deliver to IFB

### 3.3 Hardware Integration

**Priority**: Medium  
**Complexity**: High

- **Teleprompter systems**: Direct API integration with Autoscript, Autocue, or PromptSmart
- **Video routers**: Trigger video source switches based on timeline changes
- **Graphics systems**: Update lower thirds and tickers based on running order

### 3.4 Mobile Companion App

**Priority**: Low  
**Complexity**: Medium

A lightweight mobile app for:
- Monitoring the running order on-the-go
- Receiving push notifications for critical changes
- Quick approve/reject via mobile (not voice)
- Not a replacement for the desktop interface

### 3.5 API Platform

**Priority**: Medium  
**Complexity**: Medium

Expose Sudriv capabilities as an API for third-party integrations:

```
POST /api/v1/sessions          # Create session
GET  /api/v1/sessions/{id}     # Get session state
POST /api/v1/sessions/{id}/propose  # Propose a change
POST /api/v1/sessions/{id}/apply    # Apply a confirmed change
GET  /api/v1/running-order/{id}     # Get current running order
```

---

## Phase 4: Intelligence

**Goal**: Transform Sudriv from a reactive tool into a proactive intelligence platform.  
**Timeline**: 6-12 months after Phase 3

### 4.1 Predictive AI

Move from reactive to proactive:

- **Story development tracking**: AI monitors developing stories and predicts when they'll need timeline space
- **Audience engagement prediction**: Suggest segment ordering based on predicted audience retention
- **Duration estimation**: AI learns typical segment durations and suggests more accurate time allocations
- **Breaking news probability**: Based on wire service velocity, predict likelihood of breaking news in the next hour

### 4.2 Cross-Show Coordination

For networks with multiple consecutive shows:

- **Handoff management**: Coordinate running order between outgoing and incoming shows
- **Content deduplication**: Avoid repeating the same story across shows
- **Shared breaking news**: One breaking news event updates all affected shows

### 4.3 Training Mode

A safe environment for junior producers to practice:

- **Simulated breaking news scenarios**: Pre-scripted scenarios that unfold in real-time
- **AI as instructor**: The agent can evaluate the producer's decisions and provide feedback
- **Difficulty levels**: Simple (single change) → Complex (multiple concurrent changes)
- **Performance scoring**: Speed, accuracy, impact analysis quality

### 4.4 Automated Scheduling

AI-assisted schedule creation (not just modification):

- **Optimal segment ordering**: Based on content type, audience flow, and editorial priority
- **Auto-fill from news pool**: Given a duration and category mix, auto-generate a running order
- **Template learning**: AI learns from past shows to suggest better default templates

### 4.5 Content Assistance

Moving beyond structure into content:

- **Teleprompter text generation**: Given a news item, generate anchor-ready teleprompter text
- **Summary generation**: Auto-summarize long stories for brief segments
- **Transition writing**: Generate smooth transitions between segments
- **Fact-checking**: Cross-reference claims in news items against trusted databases

### 4.6 Sentiment-Aware Production

- **Tone analysis**: Monitor the tone of the broadcast and suggest adjustments
- **Audience sentiment**: If integrated with social media, react to audience sentiment in real-time
- **Sensitivity alerts**: Flag potentially sensitive content that requires editorial review

---

## Technical Debt & Improvement Backlog

### Short-Term (Address during or after MVP)

| Item | Priority | Description |
|------|----------|-------------|
| Type generation | High | Automate Supabase → TypeScript type generation in CI |
| Error boundaries | High | Add React error boundaries around all panels |
| Agent testing | High | Unit tests for all tool functions |
| Load testing | Medium | Simulate 30-minute session with rapid changes |
| Accessibility | Medium | Screen reader support, keyboard navigation |
| Logging | Medium | Structured logging with session correlation |

### Medium-Term

| Item | Priority | Description |
|------|----------|-------------|
| Agent state machine | High | Formalize agent state (idle/listening/thinking/speaking) |
| Context window management | High | Automated summarization when context approaches limit |
| Database indexes | Medium | Review and optimize as query patterns emerge |
| Rate limiting | Medium | Protect API routes from abuse |
| Cache warming | Medium | Pre-warm Redis on session creation, not on first read |
| Connection pooling | Medium | Optimize Supabase + Redis connection management |

### Long-Term

| Item | Priority | Description |
|------|----------|-------------|
| Multi-region | Medium | Deploy to multiple regions for global latency optimization |
| Event sourcing | Medium | Consider full event sourcing for running order history |
| Feature flags | Low | LaunchDarkly or similar for gradual rollouts |
| A/B testing | Low | Test different system prompts and voice configurations |

---

## Success Criteria for Each Phase

### Phase 1 (MVP) ✅
- [ ] 5-minute demo works end-to-end without failure
- [ ] Voice round-trip latency < 2 seconds
- [ ] All 5 tools function correctly
- [ ] Hinglish code-switching works naturally
- [ ] Impact analysis is accurate for all change types
- [ ] Zero unconfirmed changes applied

### Phase 2 (Production Ready)
- [ ] 30-minute session stability
- [ ] Real news items ingested and prioritized correctly
- [ ] Multiple producers can run concurrent sessions
- [ ] Analytics dashboard shows meaningful metrics
- [ ] Session recordings are playable and auditable

### Phase 3 (Scale & Integrate)
- [ ] At least one NRCS integration working
- [ ] Real IFB audio delivered to anchor
- [ ] API serving third-party consumers
- [ ] System handles 10+ concurrent sessions

### Phase 4 (Intelligence)
- [ ] Predictive alerts ahead of breaking news
- [ ] Training mode used by at least 3 newsroom trainees
- [ ] Auto-scheduling produces viable running orders
- [ ] Cross-show coordination tested with 2+ concurrent shows
