# Sudriv — Deployment Guide

Production targets:

| App | Platform | Root |
|-----|----------|------|
| Frontend | [Vercel](https://vercel.com) | `apps/web` |
| Voice agent | [Railway](https://railway.app) | `apps/agent` |

External (already SaaS): **LiveKit Cloud**, **Supabase**, **Upstash**, **OpenAI**, **Sarvam**.

Also see: [README.md](./README.md) · [TESTING.md](./TESTING.md) · [docs/DECISIONS.md](./docs/DECISIONS.md)

---

## 1. Frontend on Vercel

### Setup

1. Import the GitHub repo in Vercel.  
2. Set **Root Directory** to `apps/web`.  
3. Framework: **Next.js** (auto-detected).  
4. Install/build: `apps/web/vercel.json` runs `pnpm install` from monorepo root with the lockfile.  

### Environment variables (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server routes only |
| `NEXT_PUBLIC_LIVEKIT_URL` | ✅ | e.g. `wss://xxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | ✅ | Token minting |
| `LIVEKIT_API_SECRET` | ✅ | Token minting |

### Local production build

```bash
pnpm install
pnpm build --filter=@sudriv/web
```

### Common Vercel failure

`ERR_PNPM_OUTDATED_LOCKFILE` → run `pnpm install` locally, commit `pnpm-lock.yaml`, push.

---

## 2. Voice agent on Railway

The agent is a **long-running LiveKit worker**. It registers **outbound** to LiveKit Cloud; Railway does not need public WebRTC UDP ports.

### Setup

1. New Railway service from this repo.  
2. **Root Directory**: `apps/agent`  
3. Builder: **Dockerfile** (`apps/agent/Dockerfile` + `railway.toml`)  
4. Start command (Docker `CMD`):  
   `uv run python main.py start`  
   (`dev` is local-only.)

### Environment variables (Railway)

| Variable | Required | Notes |
|----------|----------|--------|
| `LIVEKIT_URL` | ✅ | Same project as web |
| `LIVEKIT_API_KEY` | ✅ | |
| `LIVEKIT_API_SECRET` | ✅ | |
| `SUPABASE_URL` | ✅ | |
| `SUPABASE_SERVICE_KEY` | ✅ | Or `SUPABASE_SERVICE_ROLE_KEY` |
| `UPSTASH_REDIS_URL` | ✅ | `rediss://…` |
| `OPENAI_API_KEY` | ✅ | |
| `SARVAM_API_KEY` | ✅ | |
| `PORT` | auto | Railway injects; health binds here |
| `OPENAI_MODEL` | optional | default `gpt-4o-mini` |
| `SUDRIV_LOG_LEVEL` | optional | default `INFO` |

### Health check

- LiveKit Agents HTTP health server on `$PORT` (default `8081` in Dockerfile).  
- After deploy, logs should show the worker registered with LiveKit.  
- If health fails while the process is fine: confirm Railway health path/port matches the worker (path `/`, port = `$PORT`).

### Local production-like run

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
| **Supabase** | Auth, Postgres |
| **Upstash Redis** | Hot running-order cache |
| **OpenAI** | Conversation LLM + tools |
| **Sarvam** | STT + TTS |

Ensure service role can read/write `sessions`, `running_orders`, `segments`, `anchor_instructions`.

---

## 4. Security

- Never commit `.env` / `.env.local` (gitignored).  
- Service role keys: **server / agent only**.  
- `NEXT_PUBLIC_*` is browser-visible — only anon keys and public URLs.  
- LiveKit secrets: server + agent only.

---

## 5. Smoke test after deploy

1. Open Vercel URL → login → create session.  
2. Timeline shows segments; Anchor Script shows text.  
3. Railway logs: worker connected / job accepted when session opens.  
4. Push-to-talk → Hindi reply → apply change → Timeline **Refresh**.  
5. Interrupt agent mid-speech with PTT.  

Full testing notes: [TESTING.md](./TESTING.md).
