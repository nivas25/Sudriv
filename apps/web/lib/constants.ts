/**
 * Application Constants
 *
 * Centralized configuration values used across the frontend.
 * See: knowledge-base/10-mvp-scope-and-demo-mode.md
 */

/** MVP demo credentials */
export const DEMO_CREDENTIALS = {
  email: "producer@sudriv.demo",
  password: "sudriv-demo-2025",
} as const;

/** Segment type labels and colors */
export const SEGMENT_TYPES = {
  headlines: { label: "Headlines", color: "bg-blue-500" },
  package: { label: "Package", color: "bg-emerald-500" },
  live: { label: "Live", color: "bg-red-500" },
  break: { label: "Break", color: "bg-gray-500" },
  weather: { label: "Weather", color: "bg-sky-500" },
  sports: { label: "Sports", color: "bg-orange-500" },
  interview: { label: "Interview", color: "bg-purple-500" },
  closing: { label: "Closing", color: "bg-slate-500" },
} as const;

/** Segment status configuration */
export const SEGMENT_STATUSES = {
  pending: { label: "Pending", icon: "⏳" },
  on_air: { label: "On Air", icon: "🔴" },
  completed: { label: "Completed", icon: "✅" },
  skipped: { label: "Skipped", icon: "⏭️" },
} as const;

/** Proposal status labels */
export const PROPOSAL_STATUSES = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
  modified: "Modified",
  expired: "Expired",
} as const;

/** Anchor instruction types */
export const INSTRUCTION_TYPES = {
  transition: "Transition",
  breaking: "Breaking",
  correction: "Correction",
  timing: "Timing",
  general: "General",
} as const;
