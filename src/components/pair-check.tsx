"use client";

import { useEffect, useState } from "react";
import type { ApiErrorBody } from "@/lib/api";
import type { ConflictExplanation, ResearcherSummary } from "@/lib/types";
import { ConflictGraph } from "./conflict-graph";
import { ResearcherPicker } from "./researcher-picker";
import { Card, Skeleton, VerdictBadge } from "./ui";

type Outcome =
  | { status: "ready"; explanation: ConflictExplanation }
  | { status: "error"; message: string };

export function PairCheck() {
  const [applicant, setApplicant] = useState<ResearcherSummary | null>(null);
  const [candidate, setCandidate] = useState<ResearcherSummary | null>(null);

  /**
   * Results are stored against the pair they were fetched for.
   *
   * Everything else about the view is then derived: no selection means the
   * prompt, a selection with no matching result means loading, and a stale
   * result from a previous pair can never be shown as if it belonged to the
   * current one. That removes the whole class of out-of-order response bugs,
   * and it means no state has to be reset from an effect.
   */
  const [outcome, setOutcome] = useState<{ pair: string; value: Outcome } | null>(
    null,
  );

  const pair = applicant && candidate ? `${applicant.id}|${candidate.id}` : null;
  const current = pair && outcome?.pair === pair ? outcome.value : null;
  const waitingForInput = pair === null;
  const isLoading = pair !== null && current === null;

  useEffect(() => {
    if (!pair || !applicant || !candidate) return;

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(
          `/api/explain?applicantId=${encodeURIComponent(applicant.id)}&candidateId=${encodeURIComponent(candidate.id)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const body = await response.json();

        if (!response.ok) {
          const error = body as ApiErrorBody;
          setOutcome({
            pair,
            value: {
              status: "error",
              message: error.error?.message ?? "The check could not be completed.",
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
              error instanceof Error ? error.message : "Could not reach the server.",
          },
        });
      }
    })();

    return () => controller.abort();
  }, [pair, applicant, candidate]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <ResearcherPicker
            label="Applicant"
            selected={applicant}
            onSelect={setApplicant}
            excludeId={candidate?.id}
          />
          <div className="hidden sm:flex items-center justify-center pb-3 text-subtle text-sm">
            vs
          </div>
          <ResearcherPicker
            label="Proposed reviewer"
            selected={candidate}
            onSelect={setCandidate}
            excludeId={applicant?.id}
          />
        </div>
      </Card>

      {waitingForInput ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-muted/50 px-6 py-12 text-center">
          <p className="font-medium">Pick two researchers</p>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Choose an applicant and a proposed reviewer above. The check runs
            automatically once both are selected.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <Card className="p-5 space-y-3" aria-busy="true">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </Card>
      ) : null}

      {current?.status === "error" ? (
        <div className="rounded-xl border border-[var(--blocked-border)] bg-blocked-soft px-5 py-4">
          <p className="font-medium text-blocked">The check failed</p>
          <p className="text-sm text-muted mt-0.5">{current.message}</p>
        </div>
      ) : null}

      {current?.status === "ready" ? <Result explanation={current.explanation} /> : null}
    </div>
  );
}

function Result({ explanation }: { explanation: ConflictExplanation }) {
  const { applicant, candidate, verdict, conflicts, graph } = explanation;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">
            <span className="font-medium">{candidate.name}</span>
            <span className="text-muted"> reviewing </span>
            <span className="font-medium">{applicant.name}</span>
          </p>
          <p className="text-xs text-muted mt-0.5">
            {conflicts.length === 0
              ? "No conflicts found under any rule"
              : `${conflicts.length} rule${conflicts.length === 1 ? "" : "s"} triggered`}
          </p>
        </div>
        <VerdictBadge verdict={verdict} />
      </div>

      <div className="px-5 py-4 space-y-5">
        {conflicts.length === 0 ? (
          <div className="rounded-lg border border-[var(--clear-border)] bg-clear-soft px-4 py-3">
            <p className="text-sm font-medium text-clear">
              No connection on record
            </p>
            <p className="text-sm text-muted mt-0.5 leading-snug">
              Neither supervision, recent co-authorship, a shared award, an
              overlapping post, nor a shared frequent collaborator links these
              two researchers.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {conflicts.map((conflict) => (
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
          <ConflictGraph data={graph} />
        </div>
      </div>
    </Card>
  );
}
