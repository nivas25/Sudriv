# 07 — Frontend Architecture

## Overview

The frontend is a **Next.js 15** application with **TypeScript**, styled with **Tailwind CSS** and **shadcn/ui** components. It provides the producer's primary visual interface for managing sessions, viewing the running order, and monitoring anchor instructions.

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.x | Framework (App Router) |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Pre-built component library |
| @dnd-kit | 6.x | Drag-and-drop for timeline |
| Framer Motion | 11.x | Animations and transitions |
| @livekit/components-react | latest | LiveKit room UI components |
| livekit-client | latest | LiveKit client SDK |
| @supabase/supabase-js | 2.x | Supabase client |
| @supabase/ssr | latest | Server-side Supabase auth |

---

## Directory Structure

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing / redirect to login
│   ├── globals.css             # Global styles + Tailwind directives
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   └── layout.tsx          # Auth layout (no sidebar)
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout with sidebar
│   │   ├── page.tsx            # Dashboard home / session setup
│   │   └── session/
│   │       └── [id]/
│   │           ├── page.tsx    # Active session view
│   │           └── loading.tsx # Session loading state
│   │
│   └── api/
│       ├── livekit/
│       │   └── token/
│       │       └── route.ts    # Generate LiveKit access tokens
│       └── session/
│           ├── route.ts        # Create / list sessions
│           └── [id]/
│               └── route.ts    # Get / update / end session
│
├── components/
│   ├── ui/                     # shadcn/ui components (auto-generated)
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── page-container.tsx
│   │
│   ├── auth/
│   │   └── login-form.tsx
│   │
│   ├── session/
│   │   ├── session-setup.tsx       # Timeline selection + start
│   │   ├── session-controls.tsx    # Session control bar
│   │   └── session-summary.tsx     # Post-session summary
│   │
│   ├── timeline/
│   │   ├── timeline-panel.tsx      # Main timeline container
│   │   ├── timeline-segment.tsx    # Individual segment card
│   │   ├── timeline-header.tsx     # Timeline header with totals
│   │   ├── segment-editor.tsx      # Inline segment editing
│   │   └── impact-overlay.tsx      # Visual diff overlay for proposals
│   │
│   ├── teleprompter/
│   │   ├── teleprompter-panel.tsx  # Teleprompter display
│   │   └── teleprompter-text.tsx   # Scrolling text component
│   │
│   ├── anchor/
│   │   ├── anchor-panel.tsx        # Anchor instruction panel
│   │   └── instruction-card.tsx    # Individual instruction display
│   │
│   └── voice/
│       ├── voice-panel.tsx         # Voice status + controls
│       ├── agent-status.tsx        # Agent connection status
│       ├── audio-visualizer.tsx    # Waveform / audio level display
│       └── transcript-display.tsx  # Live transcript
│
├── hooks/
│   ├── use-session.ts              # Session state management
│   ├── use-running-order.ts        # Running order subscription
│   ├── use-anchor-instructions.ts  # Anchor instruction subscription
│   ├── use-proposals.ts            # Proposal state tracking
│   ├── use-livekit.ts              # LiveKit room management
│   └── use-supabase.ts             # Supabase client + auth
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client
│   │   └── middleware.ts           # Auth middleware
│   ├── livekit/
│   │   └── token.ts                # Token generation utility
│   ├── utils.ts                    # General utilities
│   └── constants.ts                # App constants
│
├── types/
│   ├── database.ts                 # Supabase-generated types
│   ├── session.ts                  # Session-related types
│   ├── timeline.ts                 # Timeline / segment types
│   └── voice.ts                    # Voice / agent types
│
├── middleware.ts                   # Next.js middleware (auth guard)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Page Layouts

### Active Session Layout (Core Production View)

This is the most important page. It's where the producer spends 95% of their time.

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo]  Session: Morning Bulletin  │ 00:14:22 / 00:30:00  [End]  │
├─────────────────────────┬───────────────────────┬───────────────────┤
│                         │                       │                   │
│    TIMELINE PANEL       │   TELEPROMPTER        │  ANCHOR           │
│    (Left — 40%)         │   PANEL               │  INSTRUCTIONS     │
│                         │   (Center — 35%)      │  (Right — 25%)    │
│  ┌───────────────────┐  │                       │                   │
│  │ 1. Headlines  ✅  │  │  ┌─────────────────┐  │  ┌─────────────┐ │
│  │    0:00 — 2:00    │  │  │                 │  │  │ Latest:     │ │
│  ├───────────────────┤  │  │  Good evening,  │  │  │ "After the  │ │
│  │ 2. Govt Policy 🔴│  │  │  the government │  │  │  headlines, │ │
│  │    2:00 — 7:00    │  │  │  today unveiled │  │  │  going to   │ │
│  ├───────────────────┤  │  │  a new policy   │  │  │  earthquake │ │
│  │ 3. Earthquake  ⏳ │  │  │  framework...   │  │  │  story."    │ │
│  │    7:00 — 10:00   │  │  │                 │  │  ├─────────────┤ │
│  ├───────────────────┤  │  │  [Auto-scroll]  │  │  │ Previous... │ │
│  │ 4. Sports      ⏳ │  │  │                 │  │  │             │ │
│  │    10:00 — 15:00  │  │  └─────────────────┘  │  └─────────────┘ │
│  ├───────────────────┤  │                       │                   │
│  │ 5. Weather     ⏳ │  │                       │                   │
│  │    15:00 — 20:00  │  │                       │                   │
│  └───────────────────┘  │                       │                   │
│                         │                       │                   │
├─────────────────────────┴───────────────────────┴───────────────────┤
│  🎙️ Voice: Connected  │  ◼ Agent: Listening  │  [Mute] [Settings] │
│  "I propose inserting the earthquake story at slot 3..."            │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (≥ 1280px) | 3-column layout as shown above |
| Laptop (≥ 1024px) | 2-column: Timeline + Teleprompter. Anchor panel in slide-over |
| Tablet (≥ 768px) | Single column with tab navigation between panels |
| Mobile (< 768px) | Not supported in MVP (PCR environment is always desktop) |

---

## Key Components

### Timeline Panel

The timeline is the central data display. It shows all segments in order with real-time status.

```typescript
// components/timeline/timeline-panel.tsx

"use client";

import { useRunningOrder } from "@/hooks/use-running-order";
import { useProposals } from "@/hooks/use-proposals";
import { TimelineSegment } from "./timeline-segment";
import { ImpactOverlay } from "./impact-overlay";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export function TimelinePanel({ sessionId }: { sessionId: string }) {
  const { segments, totalDuration, isLoading } = useRunningOrder(sessionId);
  const { pendingProposal } = useProposals(sessionId);
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    // Handle manual reorder via drag-and-drop
    // Writes directly to Supabase, which triggers Realtime + cache invalidation
  };

  return (
    <div className="flex flex-col h-full">
      <TimelineHeader
        segmentCount={segments.length}
        totalDuration={totalDuration}
      />
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={segments.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex-1 overflow-y-auto space-y-2 p-4">
            {segments.map((segment) => (
              <TimelineSegment
                key={segment.id}
                segment={segment}
                isAffected={pendingProposal?.affectedIds.includes(segment.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {pendingProposal && (
        <ImpactOverlay proposal={pendingProposal} />
      )}
    </div>
  );
}
```

### Segment Visual States

Each segment card has distinct visual states:

| Status | Visual |
|--------|--------|
| `pending` | Default card styling, muted border |
| `on_air` | Red border, pulsing red dot indicator, elevated shadow |
| `completed` | Green check, slightly dimmed |
| `skipped` | Strikethrough title, fully dimmed |
| `affected_by_proposal` | Yellow border, animated highlight pulse |
| `newly_proposed` | Dashed green border, "NEW" badge |

### Impact Overlay

When a proposal is pending, an overlay shows the before/after comparison:

```typescript
// components/timeline/impact-overlay.tsx

export function ImpactOverlay({ proposal }: { proposal: Proposal }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
    >
      <div className="p-6 bg-card rounded-lg border border-warning m-4">
        <h3 className="text-lg font-semibold">Proposed Change</h3>
        <p className="text-muted-foreground">{proposal.summary}</p>
        
        <div className="mt-4 space-y-2">
          {proposal.affectedSegments.map((seg) => (
            <div key={seg.id} className="flex items-center gap-2">
              <span className="text-sm">
                {seg.title}: Slot {seg.oldPosition} → {seg.newPosition}
              </span>
              {seg.delaySeconds > 0 && (
                <Badge variant="warning">
                  +{Math.floor(seg.delaySeconds / 60)}min
                </Badge>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex gap-2">
          <Badge variant={proposal.durationChange > 0 ? "destructive" : "success"}>
            Duration: {proposal.durationChange > 0 ? "+" : ""}
            {Math.floor(proposal.durationChange / 60)} min
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}
```

---

## Real-time Subscriptions

The frontend subscribes to Supabase Realtime channels for live updates.

```typescript
// hooks/use-running-order.ts

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Segment, RunningOrder } from "@/types/timeline";

export function useRunningOrder(sessionId: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Initial load
  useEffect(() => {
    async function load() {
      const { data: ro } = await supabase
        .from("running_orders")
        .select("*, segments(*)")
        .eq("session_id", sessionId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (ro) {
        setSegments(
          ro.segments.sort((a: Segment, b: Segment) => a.position - b.position)
        );
        setTotalDuration(ro.total_duration_seconds);
        setVersion(ro.version);
      }
      setIsLoading(false);
    }
    load();
  }, [sessionId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`running-order-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "running_orders",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          // New version of running order — reload segments
          const newRo = payload.new as RunningOrder;
          if (newRo.version > version) {
            const { data: segs } = await supabase
              .from("segments")
              .select("*")
              .eq("running_order_id", newRo.id)
              .order("position");

            if (segs) {
              setSegments(segs);
              setTotalDuration(newRo.total_duration_seconds);
              setVersion(newRo.version);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, version]);

  return { segments, totalDuration, version, isLoading };
}
```

### Anchor Instructions Subscription

```typescript
// hooks/use-anchor-instructions.ts

export function useAnchorInstructions(sessionId: string) {
  const [instructions, setInstructions] = useState<AnchorInstruction[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial load
    supabase
      .from("anchor_instructions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setInstructions(data);
      });

    // Real-time subscription
    const channel = supabase
      .channel(`anchor-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "anchor_instructions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newInstruction = payload.new as AnchorInstruction;
          setInstructions((prev) => [newInstruction, ...prev]);
          
          // Optionally play a notification sound
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { instructions };
}
```

---

## LiveKit Integration

### Room Connection

```typescript
// hooks/use-livekit.ts

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
} from "@livekit/components-react";

export function useLiveKitToken(sessionId: string) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function getToken() {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      const { token } = await response.json();
      setToken(token);
    }
    getToken();
  }, [sessionId]);

  return token;
}
```

### Token Generation (API Route)

```typescript
// app/api/livekit/token/route.ts

import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: `producer-${sessionId}`,
      name: "Producer",
      metadata: JSON.stringify({ role: "producer", sessionId }),
    }
  );

  token.addGrant({
    room: `sudriv-session-${sessionId}`,
    roomJoin: true,
    canPublish: true,       // Producer can speak
    canSubscribe: true,     // Producer can hear the agent
    canPublishData: true,   // For data channel messages
  });

  return NextResponse.json({
    token: await token.toJwt(),
    roomName: `sudriv-session-${sessionId}`,
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  });
}
```

### Voice Panel Component

```typescript
// components/voice/voice-panel.tsx

"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import { useLiveKitToken } from "@/hooks/use-livekit";

export function VoicePanel({ sessionId }: { sessionId: string }) {
  const token = useLiveKitToken(sessionId);

  if (!token) return <VoicePanelSkeleton />;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      audio={true}
      video={false}
    >
      <VoiceAssistantUI />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function VoiceAssistantUI() {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
      {/* Agent status indicator */}
      <div className="flex items-center gap-2">
        <StatusDot state={state} />
        <span className="text-sm font-medium">
          {state === "listening" && "Listening..."}
          {state === "thinking" && "Processing..."}
          {state === "speaking" && "Speaking..."}
          {state === "idle" && "Ready"}
        </span>
      </div>

      {/* Audio visualizer */}
      <div className="flex-1">
        <BarVisualizer
          state={state}
          barCount={5}
          trackRef={audioTrack}
          className="h-8"
        />
      </div>

      {/* Controls */}
      <VoiceAssistantControlBar />
    </div>
  );
}
```

---

## Animations (Framer Motion)

### Segment Enter/Exit

```typescript
<AnimatePresence mode="popLayout">
  {segments.map((segment) => (
    <motion.div
      key={segment.id}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <TimelineSegment segment={segment} />
    </motion.div>
  ))}
</AnimatePresence>
```

### Proposal Highlight Pulse

```typescript
const pulseVariants = {
  idle: { borderColor: "transparent" },
  affected: {
    borderColor: ["#f59e0b", "#fbbf24", "#f59e0b"],
    transition: { repeat: Infinity, duration: 1.5 },
  },
};
```

### On-Air Indicator

```typescript
const onAirVariants = {
  pulse: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.5, 1],
    transition: { repeat: Infinity, duration: 1 },
  },
};
```

---

## State Management Strategy

| State Type | Solution | Rationale |
|-----------|----------|-----------|
| Server state (running order, segments) | Supabase Realtime + React hooks | Single source of truth with real-time push |
| Session state (current session ID, status) | React Context (`SessionProvider`) | Shared across all components in session view |
| Voice state (agent status, transcript) | LiveKit hooks (`useVoiceAssistant`) | Managed by LiveKit SDK |
| UI state (panel visibility, selected segment) | Local React state / `useState` | Ephemeral, no persistence needed |
| Form state (segment editor) | React Hook Form | Validation + controlled inputs |
| Pending proposals | Supabase Realtime subscription | Synced from agent via database |

### No Global State Library

For the MVP, we deliberately avoid Redux, Zustand, or similar. The combination of Supabase Realtime subscriptions and React Context is sufficient. This keeps the mental model simple: **data flows from the database, not from a local store**.

---

## Performance Optimizations

| Optimization | Implementation |
|-------------|----------------|
| React Server Components | Dashboard, session setup, and static UI rendered on server |
| Dynamic imports | Voice panel loaded only when session is active |
| Optimistic updates | Drag-and-drop updates show immediately, then persist |
| Subscription deduplication | Single Supabase channel per table per session |
| Memoized components | Segment cards memoized to prevent re-renders on unrelated changes |
| Virtualized list | If segment count exceeds 20, use react-window for timeline |

---

## Theming

### Design System

```css
/* globals.css — CSS custom properties */

:root {
  /* Colors */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --primary: 222 47% 31%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --destructive: 0 84% 60%;
  --warning: 38 92% 50%;
  --success: 142 76% 36%;
  --on-air: 0 100% 50%;
  
  /* Spacing */
  --panel-gap: 1rem;
  --segment-gap: 0.5rem;
  
  /* Timing */
  --transition-fast: 150ms;
  --transition-normal: 300ms;
}

.dark {
  --background: 222 47% 6%;
  --foreground: 210 40% 98%;
  /* ... dark mode overrides */
}
```

### Production Mode

The session view should default to **dark mode** to match the typical PCR environment (dim lighting, multiple monitors). The dashboard can use light mode.
