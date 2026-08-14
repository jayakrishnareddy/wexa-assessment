"use client";

import { useMemo, useRef, useState } from "react";
import type { Verdict } from "@/lib/domain";
import type { ScreenedReviewer, ScreeningResult } from "@/lib/types";
import { VerdictBadge } from "./ui";
import { ExplanationPanel } from "./explanation-panel";
import { Tour } from "./tour";

type Filter = "all" | Verdict;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "clear", label: "Eligible" },
  { id: "caution", label: "Review with care" },
  { id: "blocked", label: "Conflicted" },
];

export function ScreeningWorkspace({ result }: { result: ScreeningResult }) {
  const { proposal, reviewers, counts } = result;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ScreenedReviewer | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reviewers.filter((reviewer) => {
      if (filter !== "all" && reviewer.verdict !== filter) return false;
      if (!needle) return true;
      return (
        reviewer.researcher.name.toLowerCase().includes(needle) ||
        (reviewer.researcher.institution ?? "").toLowerCase().includes(needle)
      );
    });
  }, [reviewers, filter, query]);

  function select(reviewer: ScreenedReviewer) {
    setSelected(reviewer);
    // On narrow screens the detail panel sits below the list, so bring it into
    // view rather than leaving the selection apparently unacknowledged.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-xs text-subtle">{proposal.reference}</span>
          <span className="text-xs text-subtle">·</span>
          <span className="text-xs text-muted">{proposal.field}</span>
          <span className="text-xs text-subtle">·</span>
          <span className="text-xs text-muted tabular">
            ${(proposal.requestedUsd / 1000).toLocaleString()}k requested from{" "}
            {proposal.funder}
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight max-w-3xl leading-snug">
          {proposal.title}
        </h1>
        <p className="text-muted mt-2 max-w-3xl leading-relaxed">
          {proposal.summary}
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4">
          <div>
            <span className="text-xs text-subtle">Applicants</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
              {proposal.applicants.map((applicant) => (
                <span key={applicant.id} className="text-sm">
                  <span className="font-medium">{applicant.name}</span>
                  {applicant.institution ? (
                    <span className="text-muted"> · {applicant.institution}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-subtle">Topics</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {proposal.topics.map((topic) => (
                <span
                  key={topic}
                  className="text-[11px] rounded-full bg-surface-muted border border-border-subtle px-2 py-0.5 text-muted"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* data-tour attributes anchor the guided walkthrough. They are queried
          by name rather than by class or DOM position, so restyling or moving
          these elements does not silently break the tour. */}
      <div data-tour="verdicts" className="grid grid-cols-3 gap-3 mb-6">
        <SummaryTile
          label="Eligible"
          value={counts.clear}
          total={reviewers.length}
          tone="clear"
        />
        <SummaryTile
          label="Review with care"
          value={counts.caution}
          total={reviewers.length}
          tone="caution"
        />
        <SummaryTile
          label="Conflicted"
          value={counts.blocked}
          total={reviewers.length}
          tone="blocked"
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div
              data-tour="filters"
              role="tablist"
              aria-label="Filter reviewers by verdict"
              className="inline-flex rounded-lg border border-border-subtle bg-surface p-0.5"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                    filter === option.id
                      ? "bg-surface-muted font-medium"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name or institution…"
              className="flex-1 min-w-48 text-sm rounded-lg border border-border-subtle bg-surface px-3 py-1.5 outline-none focus:border-accent transition-colors"
            />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong bg-surface-muted/50 px-6 py-12 text-center">
              <p className="font-medium">No reviewers match</p>
              <p className="text-sm text-muted mt-1">
                {reviewers.length === 0
                  ? "No researcher in the graph has recorded expertise in this proposal's topics."
                  : "Try a different filter or clear the search box."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((reviewer, index) => (
                <li
                  key={reviewer.researcher.id}
                  data-tour={index === 0 ? "reviewer" : undefined}
                >
                  <ReviewerRow
                    reviewer={reviewer}
                    selected={selected?.researcher.id === reviewer.researcher.id}
                    onSelect={() => select(reviewer)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div data-tour="evidence" ref={panelRef} className="lg:sticky lg:top-20">
          <ExplanationPanel reviewer={selected} proposal={proposal} />
        </div>
      </div>

      <Tour />
    </>
  );
}

function SummaryTile({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: Verdict;
}) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  const color =
    tone === "clear"
      ? "var(--clear)"
      : tone === "caution"
        ? "var(--caution)"
        : "var(--blocked)";

  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="tabular text-2xl font-semibold tracking-tight">
          {value}
        </span>
        <span className="tabular text-xs text-subtle">{percent}%</span>
      </div>
      <div className="h-1 rounded-full bg-surface-muted mt-2 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ReviewerRow({
  reviewer,
  selected,
  onSelect,
}: {
  reviewer: ScreenedReviewer;
  selected: boolean;
  onSelect: () => void;
}) {
  const { researcher, conflicts, expertiseScore, matchedTopics } = reviewer;

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left rounded-xl border bg-surface px-4 py-3.5 transition-all ${
        selected
          ? "border-accent shadow-sm"
          : "border-border-subtle hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{researcher.name}</span>
            <VerdictBadge verdict={reviewer.verdict} size="sm" />
          </div>
          <p className="text-sm text-muted mt-0.5">
            {researcher.seniority}
            {researcher.institution ? ` · ${researcher.institution}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="tabular text-sm font-medium">{expertiseScore}</div>
          <div className="text-[11px] text-subtle">expertise</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {matchedTopics.map((topic) => (
          <span
            key={topic}
            className="text-[11px] rounded-full bg-accent-soft text-accent px-2 py-0.5"
          >
            {topic}
          </span>
        ))}
      </div>

      {conflicts.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {conflicts.map((conflict) => (
            <li
              key={`${conflict.ruleId}-${conflict.withApplicantId}`}
              className="flex items-start gap-2 text-[13px]"
            >
              <span
                className={`mt-1.5 size-1.5 rounded-full shrink-0 ${
                  conflict.severity === "blocking" ? "bg-blocked" : "bg-caution"
                }`}
              />
              <span className="text-muted">
                <span className="text-foreground font-medium">
                  {conflict.label}
                </span>{" "}
                with {conflict.withApplicantName} — {conflict.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}
