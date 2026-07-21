# 08 — Backend & Realtime

## Overview

Sudriv's backend is **serverless-first**. There is no custom backend server. Instead:

- **Supabase** handles database, auth, and realtime subscriptions
- **Next.js API Routes** handle token generation and session orchestration
- **LiveKit Cloud** handles voice transport and agent hosting
- **Redis (Upstash)** handles hot state caching

This document covers the backend logic, API design, realtime configuration, and data synchronization patterns.

---

## API Routes (Next.js)

### Session Management

#### `POST /api/session` — Create Session

```typescript
// app/api/session/route.ts

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { timelineTemplateId, newsCategory } = await request.json();

  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check for existing active session
  const { data: existingSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (existingSession) {
    return NextResponse.json(
      { error: "Active session already exists", sessionId: existingSession.id },
      { status: 409 }
    );
  }

  // 3. Load timeline template
  const { data: template } = await supabase
    .from("timelines_library")
    .select("*")
    .eq("id", timelineTemplateId)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // 4. Create session
  const roomName = `sudriv-session-${crypto.randomUUID().slice(0, 8)}`;
  
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      timeline_template_id: timelineTemplateId,
      status: "active",
      livekit_room_name: roomName,
      config: { newsCategory },
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // 5. Create initial running order from template
  const { data: runningOrder } = await supabase
    .from("running_orders")
    .insert({
      session_id: session.id,
      version: 1,
      total_duration_seconds: template.default_duration_seconds,
    })
    .select()
    .single();

  // 6. Create segments from template
  const segments = template.default_segments.map(
    (seg: any, index: number) => ({
      running_order_id: runningOrder.id,
      position: seg.position || index + 1,
      title: seg.title,
      slug: seg.slug,
      segment_type: seg.segment_type,
      duration_seconds: seg.duration_seconds,
      start_offset_seconds: seg.start_offset_seconds || 0,
      status: "pending",
      teleprompter_text: seg.teleprompter_text || "",
    })
  );

  // Calculate start offsets
  let cumulativeOffset = 0;
  for (const seg of segments) {
    seg.start_offset_seconds = cumulativeOffset;
    cumulativeOffset += seg.duration_seconds;
  }

  await supabase.from("segments").insert(segments);

  // 7. Create LiveKit room
  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );

  await roomService.createRoom({
    name: roomName,
    emptyTimeout: 3600,   // 1 hour
    maxParticipants: 3,    // Producer + Agent + (optional observer)
    metadata: JSON.stringify({
      session_id: session.id,
      user_id: user.id,
      news_category: newsCategory,
      timeline_name: template.name,
    }),
  });

  // 8. Seed Redis cache
  await seedRedisCache(session.id, runningOrder, segments);

  // 9. Log session start event
  await supabase.from("session_events").insert({
    session_id: session.id,
    event_type: "session_started",
    payload: {
      timeline_template_id: timelineTemplateId,
      timeline_name: template.name,
      news_category: newsCategory,
    },
    source: "system",
  });

  return NextResponse.json({
    sessionId: session.id,
    roomName,
    status: "active",
  });
}


async function seedRedisCache(
  sessionId: string,
  runningOrder: any,
  segments: any[]
) {
  const redis = createRedisClient();
  
  const cacheData = {
    session_id: sessionId,
    version: runningOrder.version,
    total_duration_seconds: runningOrder.total_duration_seconds,
    segments: segments.sort((a, b) => a.position - b.position),
    updated_at: new Date().toISOString(),
  };

  await redis.set(
    `session:${sessionId}:running_order`,
    JSON.stringify(cacheData),
    { ex: 7200 }
  );
}
```

#### `POST /api/session/[id]` — End Session

```typescript
// app/api/session/[id]/route.ts

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const sessionId = params.id;
  const { action } = await request.json();

  if (action === "end") {
    // 1. Update session status
    await supabase
      .from("sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // 2. Delete LiveKit room
    const { data: session } = await supabase
      .from("sessions")
      .select("livekit_room_name")
      .eq("id", sessionId)
      .single();

    if (session?.livekit_room_name) {
      const roomService = new RoomServiceClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      );
      await roomService.deleteRoom(session.livekit_room_name);
    }

    // 3. Clear Redis cache
    const redis = createRedisClient();
    await redis.del(
      `session:${sessionId}:running_order`,
      `session:${sessionId}:pending_proposal`,
      `session:${sessionId}:agent_context`,
      `session:${sessionId}:lock`
    );

    // 4. Log event
    await supabase.from("session_events").insert({
      session_id: sessionId,
      event_type: "session_ended",
      payload: { ended_at: new Date().toISOString() },
      source: "system",
    });

    // 5. Generate session summary
    const summary = await generateSessionSummary(supabase, sessionId);

    return NextResponse.json({ status: "ended", summary });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}


async function generateSessionSummary(supabase: any, sessionId: string) {
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  const { data: events } = await supabase
    .from("session_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");

  const { data: proposals } = await supabase
    .from("proposals")
    .select("*")
    .eq("session_id", sessionId);

  const { data: instructions } = await supabase
    .from("anchor_instructions")
    .select("*")
    .eq("session_id", sessionId);

  const startedAt = new Date(session.started_at);
  const endedAt = new Date(session.ended_at);
  const durationMinutes = Math.round(
    (endedAt.getTime() - startedAt.getTime()) / 60000
  );

  return {
    sessionId,
    durationMinutes,
    totalEvents: events.length,
    proposalsCreated: proposals.length,
    proposalsConfirmed: proposals.filter((p: any) => p.status === "confirmed").length,
    proposalsRejected: proposals.filter((p: any) => p.status === "rejected").length,
    anchorInstructions: instructions.length,
    runningOrderChanges: events.filter(
      (e: any) => e.event_type === "running_order_updated"
    ).length,
  };
}
```

---

## Supabase Realtime Configuration

### Enabling Realtime on Tables

Realtime must be explicitly enabled on each table that needs live subscriptions:

```sql
-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE running_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE segments;
ALTER PUBLICATION supabase_realtime ADD TABLE anchor_instructions;
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
```

### Channel Design

| Channel | Table | Event | Filter | Consumer |
|---------|-------|-------|--------|----------|
| `running-order-{sessionId}` | `running_orders` | INSERT | `session_id=eq.{sessionId}` | Timeline Panel |
| `anchor-{sessionId}` | `anchor_instructions` | INSERT | `session_id=eq.{sessionId}` | Anchor Panel |
| `proposals-{sessionId}` | `proposals` | INSERT, UPDATE | `session_id=eq.{sessionId}` | Impact Overlay |
| `session-{sessionId}` | `sessions` | UPDATE | `id=eq.{sessionId}` | Session Controls |

### Realtime Performance Considerations

1. **Filter early**: Always use `filter` in subscriptions to reduce payload size
2. **One channel per table per session**: Avoid subscribing to the same table multiple times
3. **Cleanup on unmount**: Always call `supabase.removeChannel()` in React cleanup
4. **Reconnection**: Supabase client handles reconnection automatically. The frontend should show a "Reconnecting..." banner during disconnection.

---

## Row Level Security (RLS)

### Policy Design

All tables have RLS enabled. Policies restrict access to the authenticated user's own data.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE running_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines_library ENABLE ROW LEVEL SECURITY;

-- Users: can read own profile
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Sessions: user can CRUD own sessions
CREATE POLICY "Users can manage own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);

-- Running orders: access through session ownership
CREATE POLICY "Users can view running orders for own sessions"
  ON running_orders FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert running orders for own sessions"
  ON running_orders FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Segments: access through running order → session chain
CREATE POLICY "Users can view segments for own sessions"
  ON segments FOR SELECT
  USING (
    running_order_id IN (
      SELECT ro.id FROM running_orders ro
      JOIN sessions s ON ro.session_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage segments for own sessions"
  ON segments FOR ALL
  USING (
    running_order_id IN (
      SELECT ro.id FROM running_orders ro
      JOIN sessions s ON ro.session_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- News items: readable by all authenticated users
CREATE POLICY "Authenticated users can read news items"
  ON news_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- Timelines library: readable by all authenticated users
CREATE POLICY "Authenticated users can read timelines"
  ON timelines_library FOR SELECT
  USING (auth.role() = 'authenticated');

-- Proposals: access through session ownership
CREATE POLICY "Users can view proposals for own sessions"
  ON proposals FOR ALL
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Anchor instructions: access through session ownership
CREATE POLICY "Users can view anchor instructions for own sessions"
  ON anchor_instructions FOR ALL
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Session events: access through session ownership
CREATE POLICY "Users can view events for own sessions"
  ON session_events FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );
```

### Service Role Access (Agent)

The voice agent uses the **Supabase service role key** which bypasses RLS. This is necessary because the agent operates server-side and needs unrestricted access to:
- Read/write running orders
- Insert proposals and anchor instructions
- Log session events

> **Security note**: The service role key must NEVER be exposed to the frontend. It is only used in the agent's Python environment and in Next.js server-side API routes.

---

## Redis (Upstash) Integration

### Client Setup

```typescript
// lib/redis/client.ts (Next.js)

import { Redis } from "@upstash/redis";

export function createRedisClient() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
  });
}
```

```python
# apps/agent/redis_client.py (Python Agent)

import os
import redis.asyncio as aioredis


def create_redis_client() -> aioredis.Redis:
    return aioredis.from_url(
        os.environ["UPSTASH_REDIS_URL"],
        decode_responses=True,
    )
```

### Cache Synchronization Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Agent       │     │   Redis      │     │   Supabase   │
│   (Writer)    │     │   (Cache)    │     │   (SoT)      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       │  1. Acquire lock    │                     │
       ├────────────────────▶│                     │
       │                     │                     │
       │  2. Read state      │                     │
       ├────────────────────▶│                     │
       │  ◀──── current RO ──┤                     │
       │                     │                     │
       │  3. Mutate + validate                     │
       │  (in-memory)        │                     │
       │                     │                     │
       │  4. Write new state │                     │
       ├────────────────────▶│                     │
       │                     │                     │
       │  5. Release lock    │                     │
       ├────────────────────▶│                     │
       │                     │                     │
       │  6. Async persist   │                     │
       ├─────────────────────┼────────────────────▶│
       │                     │                     │
       │                     │    7. Realtime      │
       │                     │    notification     │
       │                     │    ────────────────▶│──▶ Frontend
       │                     │                     │
```

### Cache Invalidation Triggers

| Trigger | Action |
|---------|--------|
| Agent applies change | Write-through: Redis first, then Supabase |
| Manual UI edit | Write to Supabase → Delete Redis key → Rebuild on next read |
| Session end | Delete all `session:{id}:*` keys |
| Redis restart | All caches rebuilt from Supabase on next access (cache miss) |

---

## Authentication Flow

### Supabase Auth Setup

```typescript
// lib/supabase/middleware.ts

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
```

### MVP Credentials

For the MVP, a single user is pre-configured in Supabase Auth:

| Field | Value |
|-------|-------|
| Email | `producer@sudriv.demo` |
| Password | `sudriv-demo-2025` |
| Display Name | Producer |
| Role | producer |

This user is created during initial project setup via the Supabase dashboard or seed script.

---

## Database Migrations

Migrations are managed through the Supabase CLI:

```
packages/database/
├── supabase/
│   ├── config.toml
│   ├── seed.sql                    # Demo data seed
│   └── migrations/
│       ├── 20250101000000_initial_schema.sql
│       ├── 20250101000001_enable_rls.sql
│       ├── 20250101000002_enable_realtime.sql
│       └── 20250101000003_seed_demo_data.sql
```

### Migration Commands

```bash
# Create a new migration
npx supabase migration new <migration_name>

# Apply migrations locally
npx supabase db reset

# Push migrations to production
npx supabase db push

# Generate TypeScript types from schema
npx supabase gen types typescript --project-id <project_id> > types/database.ts
```
