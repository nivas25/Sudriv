"use client";

/**
 * TeleprompterText — Scrolling text component
 *
 * TODO: Implement smooth scrolling text display
 * - Large readable font
 * - Configurable scroll speed
 * - Manual scroll override
 */
export function TeleprompterText({ text }: { text: string }) {
  return (
    <div className="teleprompter-text leading-relaxed">
      {text || "No text loaded."}
    </div>
  );
}
