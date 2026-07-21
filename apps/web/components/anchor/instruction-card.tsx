"use client";

import { cn } from "@/lib/utils";
import { INSTRUCTION_TYPES } from "@/lib/constants";
import type { AnchorInstruction } from "@/types/timeline";

/**
 * InstructionCard — Individual anchor instruction display
 */
export function InstructionCard({
  instruction,
}: {
  instruction: AnchorInstruction;
}) {
  const typeLabel =
    INSTRUCTION_TYPES[
      instruction.instruction_type as keyof typeof INSTRUCTION_TYPES
    ] ?? instruction.instruction_type;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border text-sm animate-slide-in-right",
        instruction.instruction_type === "breaking" &&
          "border-on-air bg-on-air/5"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {typeLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(instruction.created_at).toLocaleTimeString()}
        </span>
      </div>
      <p className="font-medium">{instruction.instruction_text}</p>
    </div>
  );
}
