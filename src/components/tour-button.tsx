"use client";

import { usePathname } from "next/navigation";
import { TOUR_EVENT } from "./tour";

/**
 * Replays the walkthrough on demand.
 *
 * Rendered only on the screening route, because that is where the tour's
 * anchors exist — a "Tour" button on the data-model page that quietly did
 * nothing would be worse than no button at all.
 *
 * It signals the tour with a DOM event rather than shared React state: the
 * header and the workspace sit in different subtrees under the root layout, and
 * threading a context provider through the whole app for one button is more
 * machinery than the job needs.
 */
export function TourButton() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/proposals/")) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
      className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2 py-1 rounded-md hover:bg-surface-muted transition-colors"
      title="Replay the guided walkthrough"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M6.3 6.1a1.75 1.75 0 1 1 2.2 2.05c-.35.11-.5.35-.5.7v.35"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11.4" r=".75" fill="currentColor" />
      </svg>
      Tour
    </button>
  );
}
