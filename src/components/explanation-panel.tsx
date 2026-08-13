"use client";

import { useEffect, useState } from "react";
import type { ApiErrorBody } from "@/lib/api";
import type {
  ConflictExplanation,
  ProposalDetail,
  ResearcherSummary,
  ScreenedReviewer,
} from "@/lib/types";
import { ConflictGraph } from "./conflict-graph";
import { Card, Skeleton, VerdictBadge } from "./ui";

type Outcome =
  | { status: "ready"; explanation: ConflictExplanation }
  | { status: "error"; message: string };

/**
 * Drill-down for one candidate reviewer.
 *
 * The screening list already says *that* someone is conflicted; this panel
 * exists to show *why*, with the underlying records and the path through the
 * graph. A panel chair overruling a flag needs to see the evidence, not a
 * score.
 */
export function ExplanationPanel({
  reviewer,
  proposal,
}: {
  reviewer: ScreenedReviewer | null;
  proposal: ProposalDetail;
}) {
  // Default to the applicant the conflict is actually with; for an unconflicted
  // reviewer there is no such applicant, so fall back to the lead.
  const defaultApplicantId =
    reviewer?.conflicts[0]?.withApplicantId ?? proposal.applicants[0]?.id ?? null;

  // The dropdown's choice is stored against the reviewer it was made for, so
  // selecting a different reviewer falls back to that reviewer's own default
  // without an effect to reset it.
  const [choice, setChoice] = useState<{
    forReviewerId: string;
    applicantId: string;
  } | null>(null);

  const applicantId =
    choice && choice.forReviewerId === reviewer?.researcher.id
      ? choice.applicantId
      : defaultApplicantId;

  // Keyed by the pair it was fetched for, so loading is derived and a response
  // for a previously selected reviewer can never render under a new one.
  const [outcome, setOutcome] = useState<{ pair: string; value: Outcome } | null>(
    null,
  );

  const candidateId = reviewer?.researcher.id ?? null;
  const pair = candidateId && applicantId ? `${applicantId}|${candidateId}` : null;
  const current = pair && outcome?.pair === pair ? outcome.value : null;
  const isLoading = pair !== null && current === null;

  useEffect(() => {
    if (!pair || !candidateId || !applicantId) return;

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(
          `/api/explain?applicantId=${encodeURIComponent(applicantId)}&candidateId=${encodeURIComponent(candidateId)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const body = await response.json();

        if (!response.ok) {
          const error = body as ApiErrorBody;
          setOutcome({
            pair,
            value: {
              status: "error",
              message: error.error?.message ?? "Could not load the explanation.",
            },
          });
          return;
        }
        setOutcome({
          pair,
          value: { status: "ready", explanation: body as ConflictExplanation },
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setOutcome({
          pair,
          value: {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not reach the server to load the explanation.",
          },
        });
      }
    })();

    return () => controller.abort();
  }, [pair, candidateId, applicantId]);

  if (!reviewer) {
    return (
      <Card className="p-6">
        <div className="text-center py-6">
          <PathMark />
          <p className="font-medium mt-3">Select a reviewer</p>
          <p className="text-sm text-muted mt-1 leading-snug">
            Choose a candidate from the list to see the records that connect
            them to the applicants, and the path through the graph.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold tracking-tight">
              {reviewer.researcher.name}
            </h3>
            <p className="text-sm text-muted mt-0.5">
              {reviewer.researcher.seniority}
              {reviewer.researcher.institution
                ? ` · ${reviewer.researcher.institution}`
                : ""}
            </p>
          </div>
          <VerdictBadge verdict={reviewer.verdict} size="sm" />
        </div>

        {proposal.applicants.length > 1 ? (
          <div className="mt-3">
            <label className="text-[11px] text-subtle block mb-1">
              Compared against
            </label>
            <select
              value={applicantId ?? ""}
              onChange={(event) =>
                setChoice({
                  forReviewerId: reviewer.researcher.id,
                  applicantId: event.target.value,
                })
              }
              className="w-full text-sm rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
            >
              {proposal.applicants.map((applicant: ResearcherSummary) => (
                <option key={applicant.id} value={applicant.id}>
                  {applicant.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-4">
        {isLoading ? <LoadingBody /> : null}

        {current?.status === "error" ? (
          <div className="rounded-lg border border-[var(--blocked-border)] bg-blocked-soft px-4 py-3">
            <p className="text-sm font-medium text-blocked">
              Could not load the evidence
            </p>
            <p className="text-sm text-muted mt-0.5">{current.message}</p>
          </div>
        ) : null}

        {current?.status === "ready" ? (
          <ExplanationBody explanation={current.explanation} />
        ) : null}
      </div>
    </Card>
  );
}

function ExplanationBody({ explanation }: { explanation: ConflictExplanation }) {
  return (
    <div className="space-y-5">
      {explanation.conflicts.length === 0 ? (
        <div className="rounded-lg border border-[var(--clear-border)] bg-clear-soft px-4 py-3">
          <p className="text-sm font-medium text-clear">No conflict found</p>
          <p className="text-sm text-muted mt-0.5 leading-snug">
            No supervision, recent co-authorship, shared award or overlapping
            post connects {explanation.candidate.name} to{" "}
            {explanation.applicant.name}.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {explanation.conflicts.map((conflict) => (
            <li key={conflict.ruleId}>
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${
                    conflict.severity === "blocking" ? "bg-blocked" : "bg-caution"
                  }`}
                />
                <span className="text-sm font-medium">{conflict.label}</span>
              </div>
              <p className="text-[13px] text-muted mt-0.5 ml-3.5">
                {conflict.detail}
              </p>
              {conflict.examples.length > 0 ? (
                <ul className="mt-1.5 ml-3.5 space-y-1">
                  {conflict.examples.map((example) => (
                    <li
                      key={example}
                      className="text-[12px] text-subtle leading-snug pl-3 border-l border-border-subtle"
                    >
                      {example}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="text-[11px] text-subtle mb-1.5">Connecting records</p>
        <ConflictGraph data={explanation.graph} />
      </div>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading evidence">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function PathMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-10 mx-auto text-border-strong"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 16 L34 12 M12 16 L28 36"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="5" fill="currentColor" />
      <circle cx="34" cy="12" r="3.5" fill="currentColor" opacity="0.6" />
      <circle cx="28" cy="36" r="3.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
