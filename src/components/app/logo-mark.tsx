import { cn } from "@/lib/utils";

/**
 * Brand mark: gradient chip with an audio-waveform glyph.
 * Shared by the landing nav, footer and the app shell.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-grad-a to-grad-b text-white shadow-sm shadow-grad-b/30",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
        <rect x="4" y="9.5" width="2.6" height="5" rx="1.3" />
        <rect x="8.6" y="6.5" width="2.6" height="11" rx="1.3" />
        <rect x="13.2" y="8" width="2.6" height="8" rx="1.3" />
        <rect x="17.8" y="4.5" width="2.6" height="15" rx="1.3" />
      </svg>
    </span>
  );
}
