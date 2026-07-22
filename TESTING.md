# Testing Notes — Sudriv

Honest record of what was verified during development and pre-deploy checks.  
This is **manual / integration testing**, not a full automated suite.

---

## Environments tested

| Layer | How it was run |
|-------|----------------|
| Frontend | `pnpm dev:web` / `pnpm build --filter=@sudriv/web` locally; Vercel deploy |
| Agent | `uv run python main.py dev` locally; Railway Docker `main.py start` |
| Media | LiveKit Cloud rooms |
| Data | Supabase project + Upstash Redis |

---

## Feature test matrix

| Area | Status | What we did | Notes |
|------|--------|-------------|--------|
| **Login + session flow** | ✅ Verified | Auth via Supabase; create session from dashboard; open `/session/{id}` | Requires seeded user + timeline template |
| **LiveKit room join** | ✅ Verified | Token API mints JWT; browser connects; agent joins room | Room name `sudriv-{sessionId}` |
| **Push-to-talk** | ✅ Verified | Mic off by default; hold button → publish audio; release → mute | Reduces false STT when silent |
| **Voice conversation** | ✅ Verified | Hindi STT → OpenAI reply → Hindi TTS | Quality depends on mic / network |
| **Interruption (barge-in)** | ✅ Verified | Hold PTT while agent speaks → agent stops quickly | Tuned with VAD `min_words=0`, low `min_duration` |
| **Timeline load** | ✅ Verified | Segments load via `/api/session/{id}/running-order` | Service-role API avoids RLS blind spots |
| **Timeline after apply** | ✅ Verified | Agent apply → Supabase rewrite → UI poll/Refresh shows new segments | Manual **Refresh** button available |
| **Anchor script** | ✅ Verified | Shows active/pending segment teleprompter; Refresh works | Fixed invalid `instruction_type` (`segment` → allowed set) |
| **Tool: impact / propose / apply** | ✅ Verified | End-to-end voice confirm path | Confirmation required before mutate |
| **Tool: push_anchor_instruction** | ✅ Verified after fix | Types normalized to DB check constraint | Types: transition, breaking, correction, timing, general |
| **Production web build** | ✅ Verified | `pnpm build --filter=@sudriv/web` exit 0 | Lockfile must stay in sync |
| **Agent container build** | ✅ Verified | Railway Docker image builds | Health check needs `$PORT` + worker start |

---

## How to re-run a full manual smoke test

### A. Frontend + agent local

```bash
# Terminal 1
pnpm install
pnpm dev:web

# Terminal 2
cd apps/agent && uv sync && uv run python main.py dev
```

1. Open `http://localhost:3000` → login.  
2. Start a session.  
3. Confirm Timeline shows segments; Anchor Script shows text.  
4. Hold mic → speak → release → hear reply.  
5. Interrupt agent mid-speech with PTT.  
6. Ask to insert a segment → confirm → Timeline Refresh.  
7. Confirm Anchor Script updates (teleprompter / cue).  

### B. Production build (CI-like)

```bash
pnpm build --filter=@sudriv/web
```

### C. Deployed stack

1. Vercel URL: login + session.  
2. Railway logs: worker registered with LiveKit.  
3. Repeat steps 3–7 above on production.

---

## Known limitations (honest)

| Item | Detail |
|------|--------|
| **Automated E2E voice tests** | Not in repo yet — voice path is manual |
| **Language** | Current product config is **Hindi-primary** STT/TTS/prompt (not full EN/Hinglish product mode) |
| **Realtime UI** | Timeline/script primarily **API poll + Refresh**, not only Supabase Realtime |
| **Agent health on Railway** | LiveKit health server on `$PORT`; ensure health path/settings match your Railway plan |
| **Template quality** | Teleprompter quality depends on seeded `default_segments` content |

---

## Failure modes we fixed during build

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Timeline empty | Browser RLS + wrong fetch path | Service-role running-order API + poll |
| Ghost transcripts | Always-on mic | Push-to-talk |
| Slow barge-in | `min_words=1` waited on STT | VAD interrupt, `min_words=0` |
| Anchor insert error | `instruction_type=segment` | Normalize to allowed enum |
| Vercel install fail | Stale `pnpm-lock.yaml` | Regenerate lockfile |

---

## What judges can assume works

- End-to-end **voice co-pilot** path with LiveKit Agents  
- **Tool-orchestrated** running-order updates with confirmation  
- **Control room UI** for timeline + anchor script  
- **Deployable** monorepo (Vercel web + Railway agent)  

See also: [README.md](./README.md) · [DEPLOY.md](./DEPLOY.md) · [docs/DECISIONS.md](./docs/DECISIONS.md)
