# Sudriv Voice Agent

LiveKit Agents worker (Python) for Sudriv.

## Run

```bash
uv sync
uv run python main.py dev     # local development
uv run python main.py start   # production (Railway / Docker)
```

Health: `http://0.0.0.0:$PORT/` (default `8081`).

## Deploy

Root docs: [DEPLOY.md](../../DEPLOY.md).  
Files: `Dockerfile`, `railway.toml`, `Procfile`.

## Environment

See `.env.example`. Required: LiveKit, Supabase service key, Redis, OpenAI, Sarvam.
