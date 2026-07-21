"use client";

/**
 * SegmentEditor — Inline editing for a single segment
 *
 * TODO: Implement inline editing of:
 * - Title
 * - Duration
 * - Segment type
 * - Teleprompter text
 */
export function SegmentEditor({ segmentId }: { segmentId: string }) {
  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground">
        Segment editor for {segmentId} — TODO
      </p>
    </div>
  );
}
