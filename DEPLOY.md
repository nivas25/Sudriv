# Sudriv — Deployment Guide

Production targets:
- **Frontend** → [Vercel](https://vercel.com) (`apps/web`)
- **Voice agent** → [Railway](https://railway.app) (`apps/agent`)
- LiveKit Cloud, Supabase, Upstash (already external)

---

## 1. Frontend on Vercel

### Setup
1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Framework: **Next.js** (auto-detected).
4. Install/build use `apps/web/vercel.json` (runs `pnpm` from monorepo root).

### Environment variables (Vercel → Project → Settings → Env)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server routes only (never expose to client) |
| `NEXT_PUBLIC_LIVEKIT_URL` | ✅ | e.g. `wss://xxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | ✅ | Token minting in `/api/livekit/token` |
| `LIVEKIT_API_SECRET` | ✅ | Token minting |

Deploy: push to `main` or run `vercel --prod` from `apps/web`.

Local check:
```bash
pnpm install
pnpm build --filter=@sudriv/web
```

---

## 2. Voice agent on Railway

LiveKit Agents register **outbound** to LiveKit Cloud. Railway keeps a long-running process; health is HTTP on `$PORT` (default `8081`).

### Setup
1. New Railway service from this repo.
2. **Root Directory**: `apps/agent`
3. Builder: **Dockerfile** (`apps/agent/Dockerfile` + `railway.toml`)
4. Start command (if not using Docker CMD):  
   `uv run python main.py start`  
   (`dev` is for local only.)

### Environment variables (Railway)

| Variable | Required | Notes |
|----------|----------|--------|
| `LIVEKIT_URL` | ✅ | Same project as web (`wss://…`) |
| `LIVEKIT_API_KEY` | ✅ | |
| `LIVEKIT_API_SECRET` | ✅ | |
| `SUPABASE_URL` | ✅ | |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role (or `SUPABASE_SERVICE_ROLE_KEY`) |
| `UPSTASH_REDIS_URL` | ✅ | `rediss://…` connection string |
| `OPENAI_API_KEY` | ✅ | LLM |
| `SARVAM_API_KEY` | ✅ | STT + TTS |
| `PORT` | auto | Railway injects; agent health binds here |
| `OPENAI_MODEL` | optional | default `gpt-4o-mini` |
| `SUDRIV_LOG_LEVEL` | optional | default `INFO` |

### Health check
- Path: `/` (LiveKit Agents worker HTTP server)
- After deploy, logs should show worker registered with LiveKit.

Local production-like run:
```bash
cd apps/agent
uv sync
uv run python main.py start
```

---

## 3. External services checklist

| Service | Purpose |
|---------|---------|
| **LiveKit Cloud** | WebRTC rooms + agent job dispatch |
| **Supabase** | Auth, Postgres, optional Realtime |
| **Upstash Redis** | Hot running-order cache for agent |
| **OpenAI** | Conversation LLM |
| **Sarvam** | STT (hi-IN) + TTS (priya) |

Ensure Supabase RLS / service role is configured so agent + `/api/session/*/running-order` can read/write sessions, running_orders, and segments.

---

## 4. Security notes

- Never commit `.env` / `.env.local` (gitignored).
- `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY` only on **server** (Vercel server env, Railway).
- `NEXT_PUBLIC_*` is browser-visible — only anon keys and public URLs.
- LiveKit secrets only on server + agent, not in client bundles.

---

## 5. Smoke test after deploy

1. Open Vercel URL → login → create session.
2. Timeline shows segments; Anchor Script shows text.
3. Railway agent logs: worker connected / job accepted when session opens.
4. Push-to-talk → Hindi reply → apply change → Timeline **Refresh** shows update.
