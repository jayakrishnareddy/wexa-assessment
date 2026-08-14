"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Bumped when the steps change materially.
 *
 * The completion flag is stored under this version, so rewriting the
 * walkthrough shows it again to people who only saw the previous one, without
 * nagging anyone who has already seen the current one.
 */
const STORAGE_KEY = "panelgraph.tour.v1";

/** Fired by the header button to replay the walkthrough on demand. */
export const TOUR_EVENT = "panelgraph:tour";

interface Step {
  /** Matches a `data-tour` attribute in the page. */
  anchor: string;
  title: string;
  body: string;
  /** Preferred side; flipped automatically when it would leave the viewport. */
  placement: "top" | "bottom" | "left" | "right";
}

const STEPS: readonly Step[] = [
  {
    anchor: "verdicts",
    title: "The verdict at a glance",
    body: "Every researcher with expertise in this proposal's topics is screened against five conflict rules, then split three ways: clear to review, worth a second look, or ruled out.",
    placement: "bottom",
  },
  {
    anchor: "filters",
    title: "Narrow the list",
    body: "Jump straight to the reviewers you can actually assign, or inspect the ones that were ruled out and why.",
    placement: "bottom",
  },
  {
    anchor: "reviewer",
    title: "Every flag states its reason",
    body: "A reviewer is never just marked conflicted. Each row names the rule that fired, who it involves, and the evidence — a joint paper, a shared grant, an overlapping post.",
    placement: "right",
  },
  {
    anchor: "evidence",
    title: "Follow the path through the graph",
    body: "Select any reviewer to see the underlying records and the chain of relationships connecting them to the applicant. This is what a graph database makes cheap: the answer arrives with its evidence.",
    placement: "left",
  },
  {
    anchor: "pair-check",
    title: "Check any two people",
    body: "Someone suggests a name in a meeting? Screen that pair directly against the same rules, without going through a proposal.",
    placement: "bottom",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 340;
const TOOLTIP_GAP = 14;
const VIEWPORT_MARGIN = 12;

function readRect(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return {
    top: box.top - SPOTLIGHT_PADDING,
    left: box.left - SPOTLIGHT_PADDING,
    width: box.width + SPOTLIGHT_PADDING * 2,
    height: box.height + SPOTLIGHT_PADDING * 2,
  };
}

function findAnchor(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
}

/**
 * Places the tooltip beside the spotlight, flipping to the opposite side when
 * the preferred one would push it off screen and clamping so it never leaves
 * the viewport. Positions are viewport-relative, matching the fixed overlay.
 */
function placeTooltip(
  rect: Rect,
  placement: Step["placement"],
  size: { width: number; height: number },
) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const fitsBelow = rect.top + rect.height + TOOLTIP_GAP + size.height < viewportHeight;
  const fitsAbove = rect.top - TOOLTIP_GAP - size.height > 0;
  const fitsRight = rect.left + rect.width + TOOLTIP_GAP + size.width < viewportWidth;
  const fitsLeft = rect.left - TOOLTIP_GAP - size.width > 0;

  let side = placement;
  if (side === "bottom" && !fitsBelow) side = fitsAbove ? "top" : "bottom";
  if (side === "top" && !fitsAbove) side = fitsBelow ? "bottom" : "top";
  if (side === "right" && !fitsRight) side = fitsLeft ? "left" : "bottom";
  if (side === "left" && !fitsLeft) side = fitsRight ? "right" : "bottom";

  let top: number;
  let left: number;

  switch (side) {
    case "top":
      top = rect.top - TOOLTIP_GAP - size.height;
      left = rect.left + rect.width / 2 - size.width / 2;
      break;
    case "bottom":
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - size.width / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - size.height / 2;
      left = rect.left - TOOLTIP_GAP - size.width;
      break;
    default:
      top = rect.top + rect.height / 2 - size.height / 2;
      left = rect.left + rect.width + TOOLTIP_GAP;
  }

  return {
    top: Math.min(
      Math.max(top, VIEWPORT_MARGIN),
      viewportHeight - size.height - VIEWPORT_MARGIN,
    ),
    left: Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      viewportWidth - size.width - VIEWPORT_MARGIN,
    ),
  };
}

/**
 * First-run guided walkthrough of the screening workspace.
 *
 * Renders nothing on the server and nothing until the completion flag has been
 * read from localStorage — a tour that appeared in the server-rendered HTML and
 * then vanished on hydration would be a hydration mismatch.
 */
export function Tour() {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltip, setTooltip] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = STEPS[index];

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    setTooltip(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // Private browsing or blocked storage: the tour simply runs again next
      // time, which is a better failure than crashing the page.
    }
  }, []);

  // Auto-start on first visit, and only once every anchor is actually present —
  // if the database is unreachable or a proposal has no reviewers, there is
  // nothing to point at and spotlighting empty space would be worse than
  // staying quiet.
  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === "done";
    } catch {
      seen = false;
    }
    if (seen) return;

    const timer = window.setTimeout(() => {
      if (STEPS.every((candidate) => findAnchor(candidate.anchor))) {
        setIndex(0);
        setActive(true);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, []);

  // Replay, triggered by the header button.
  useEffect(() => {
    function onReplay() {
      if (!STEPS.every((candidate) => findAnchor(candidate.anchor))) return;
      setIndex(0);
      setActive(true);
    }
    window.addEventListener(TOUR_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_EVENT, onReplay);
  }, []);

  // Measure the current anchor, and keep the spotlight glued to it while the
  // page scrolls or resizes.
  useLayoutEffect(() => {
    if (!active || !step) return;

    const element = findAnchor(step.anchor);
    if (!element) {
      // Defensive: the overlay blocks interaction, so an anchor should not be
      // able to disappear mid-tour. If one does, close rather than spotlight a
      // stale rectangle — deferred by a tick because updating state
      // synchronously inside an effect triggers a cascading render.
      const bail = window.setTimeout(finish, 0);
      return () => window.clearTimeout(bail);
    }

    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
      inline: "nearest",
    });

    const measure = () => {
      const current = findAnchor(step.anchor);
      if (current) setRect(readRect(current));
    };

    measure();
    const settle = window.setTimeout(measure, 420);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, finish]);

  // Position the tooltip once its rendered height is known.
  useLayoutEffect(() => {
    if (!rect || !step || !tooltipRef.current) return;
    const box = tooltipRef.current.getBoundingClientRect();
    setTooltip(
      placeTooltip(rect, step.placement, { width: box.width, height: box.height }),
    );
  }, [rect, step]);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current >= STEPS.length - 1) {
        finish();
        return current;
      }
      return current + 1;
    });
  }, [finish]);

  const back = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish, next, back]);

  if (!active || !step || !rect) return null;

  const isLast = index === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Guided walkthrough"
    >
      {/* The scrim is the spotlight's own outward shadow, so there is exactly
          one element and the cutout can never drift out of alignment with it. */}
      <div
        data-testid="tour-spotlight"
        className="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out motion-reduce:transition-none"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: "0 0 0 9999px rgba(8, 10, 15, 0.62)",
          outline: "2px solid var(--accent)",
          outlineOffset: "-1px",
        }}
      />

      {/* Clicking the dimmed area dismisses, matching what people expect of an
          overlay; the tooltip itself stops the event. */}
      <button
        aria-label="Skip walkthrough"
        tabIndex={-1}
        onClick={finish}
        className="absolute inset-0 cursor-default"
      />

      <div
        ref={tooltipRef}
        data-testid="tour-tooltip"
        style={{
          width: TOOLTIP_WIDTH,
          top: tooltip?.top ?? -9999,
          left: tooltip?.left ?? -9999,
          visibility: tooltip ? "visible" : "hidden",
        }}
        className="absolute rounded-xl border border-border-subtle bg-surface shadow-xl p-4"
      >
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="text-[11px] tabular text-subtle">
            Step {index + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-[11px] text-subtle hover:text-foreground transition-colors"
          >
            Skip
          </button>
        </div>

        <h2 className="text-sm font-semibold tracking-tight">{step.title}</h2>
        <p className="text-[13px] text-muted leading-snug mt-1">{step.body}</p>

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((candidate, dot) => (
              <span
                key={candidate.anchor}
                className={`size-1.5 rounded-full transition-colors ${
                  dot === index ? "bg-accent" : "bg-border-strong"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 ? (
              <button
                onClick={back}
                className="text-xs px-2.5 py-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
              >
                Back
              </button>
            ) : null}
            <button
              onClick={next}
              autoFocus
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90 transition-opacity"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
