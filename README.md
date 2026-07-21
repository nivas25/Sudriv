# Sudriv

> Sudriv turns breaking news chaos into calm. Producer speaks, AI updates timeline & tells the anchor.

Real-time AI co-pilot for television news producers. Voice-controlled running order management with intelligent impact analysis and anchor instruction generation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · @dnd-kit · Framer Motion |
| Voice Agent | LiveKit Agents SDK (Python) · Sarvam STT/TTS · Groq Llama 3.3 70B |
| Database | Supabase (Postgres + Realtime + Auth) |
| Cache | Redis (Upstash) |
| Deployment | Vercel · LiveKit Cloud · Supabase Cloud · Upstash |

## Project Structure

```
sudriv/
├── apps/
│   ├── web/              # Next.js 15 frontend
│   └── agent/            # LiveKit voice agent (Python)
├── packages/
│   ├── shared/           # Shared TypeScript types and constants
│   └── database/         # Supabase migrations, seed data, generated types
├── knowledge-base/       # Complete project documentation
├── package.json          # Root workspace config
├── pnpm-workspace.yaml   # pnpm workspace definition
├── turbo.json            # Turborepo pipeline config
└── .env.example          # Environment variable template
```

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Python** ≥ 3.11
- **uv** (Python package manager — `pip install uv` or see [docs](https://docs.astral.sh/uv/))

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-org/sudriv.git
cd sudriv

# Install Node.js dependencies (frontend + packages)
pnpm install

# Install Python dependencies (agent)
cd apps/agent
uv sync
cd ../..
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Copy to individual apps
cp .env.example apps/web/.env.local
cp .env.example apps/agent/.env
```

Fill in all values — see `.env.example` for the required variables.

### 3. Database Setup

```bash
# Link your Supabase project
cd packages/database
npx supabase link --project-ref your-project-ref

# Run migrations
npx supabase db push

# Seed demo data
npx supabase db reset
```

### 4. Run Development Servers

**Frontend (Next.js):**
```bash
pnpm dev:web
# → http://localhost:3000
```

**Voice Agent (LiveKit):**
```bash
pnpm dev:agent
# or directly:
cd apps/agent && uv run python main.py dev
```

**Both (via Turborepo):**
```bash
pnpm dev
```

## Demo Credentials (MVP)

| Field | Value |
|-------|-------|
| Email | `producer@sudriv.demo` |
| Password | `sudriv-demo-2025` |

## Documentation

See the [knowledge-base/](./knowledge-base/) folder for complete technical documentation.

## License

Private — All rights reserved.
