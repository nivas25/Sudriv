# Sudriv

> Sudriv turns breaking news chaos into calm. Producer speaks, AI updates the timeline & tells the anchor.

Real-time AI co-pilot for television news producers — voice-controlled running order management with impact analysis and anchor cues.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 · TypeScript · Tailwind · LiveKit React |
| Voice Agent | LiveKit Agents 1.6 · Sarvam STT/TTS · OpenAI `gpt-4o-mini` |
| Database | Supabase (Postgres + Auth) |
| Cache | Upstash Redis |
| Deploy | **Vercel** (web) · **Railway** (agent) · LiveKit Cloud |

## Project Structure

```
sudriv/
├── apps/
│   ├── web/                 # Next.js frontend (Vercel)
│   └── agent/               # LiveKit voice agent (Railway)
├── knowledge-base/          # Product & architecture docs
├── package.json             # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── DEPLOY.md                # Production deploy guide
└── .env.example
```

## Prerequisites

- Node.js ≥ 20, pnpm ≥ 9  
- Python ≥ 3.11, [uv](https://docs.astral.sh/uv/)  
- Accounts: LiveKit Cloud, Supabase, Upstash, OpenAI, Sarvam  

## Local development

```bash
git clone <repo>
cd sudriv
pnpm install

# Web
cp apps/web/.env.example apps/web/.env.local   # fill values
pnpm dev:web

# Agent
cd apps/agent
cp .env.example .env                           # fill values
uv sync
uv run python main.py dev
```

## Production

See **[DEPLOY.md](./DEPLOY.md)** for Vercel + Railway setup and full environment variable lists.

```bash
# Verify web build (CI / pre-deploy)
pnpm build --filter=@sudriv/web

# Agent production entrypoint
cd apps/agent && uv run python main.py start
```

## License

Private — all rights reserved.
