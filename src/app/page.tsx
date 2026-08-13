import Link from "next/link";
import { CONFLICT_RULES } from "@/lib/domain";
import { listProposals } from "@/lib/queries/proposals";
import { getGraphStats } from "@/lib/queries/researchers";
import { load } from "@/lib/server-data";
import { Card, DatabaseErrorState, EmptyState, StatTile } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, proposals] = await Promise.all([
    load(getGraphStats),
    load(listProposals),
  ]);

  if (!proposals.ok) {
    return (
      <Container>
        <Hero />
        <DatabaseErrorState
          kind={proposals.kind}
          message={proposals.message}
          details={proposals.details}
        />
      </Container>
    );
  }

  return (
    <Container>
      <Hero />

      {stats.ok ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          <StatTile label="Researchers" value={stats.data.researchers} />
          <StatTile label="Papers" value={stats.data.papers} />
          <StatTile label="Grants" value={stats.data.grants} />
          <StatTile label="Institutions" value={stats.data.institutions} />
          <StatTile label="Proposals" value={stats.data.proposals} />
          <StatTile label="Relationships" value={stats.data.relationships} />
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Proposals awaiting reviewer assignment
            </h2>
            <span className="text-xs text-subtle tabular">
              {proposals.data.length} open
            </span>
          </div>

          {proposals.data.length === 0 ? (
            <EmptyState
              title="No proposals in the graph"
              description="Run the seed script to load the demonstration dataset, then reload this page."
            />
          ) : (
            <ul className="space-y-2.5">
              {proposals.data.map((proposal) => (
                <li key={proposal.id}>
                  <Link
                    href={`/proposals/${proposal.id}`}
                    className="block rounded-xl border border-border-subtle bg-surface px-5 py-4 hover:border-border-strong hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] text-subtle">
                            {proposal.reference}
                          </span>
                          <span className="text-[11px] text-subtle">·</span>
                          <span className="text-[11px] text-muted">
                            {proposal.field}
                          </span>
                        </div>
                        <h3 className="font-medium leading-snug group-hover:text-accent transition-colors">
                          {proposal.title}
                        </h3>
                        <p className="text-sm text-muted mt-1.5">
                          {proposal.applicants
                            .map((applicant) => applicant.name)
                            .join(", ")}
                          {proposal.applicants[0]?.institution
                            ? ` · ${proposal.applicants[0].institution}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tabular text-sm font-medium">
                          ${(proposal.requestedUsd / 1000).toLocaleString()}k
                        </div>
                        <div className="text-[11px] text-subtle mt-0.5">
                          {proposal.funder}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <h3 className="text-sm font-semibold tracking-tight mb-3">
              Conflict rules applied
            </h3>
            <ul className="space-y-3">
              {CONFLICT_RULES.map((rule) => (
                <li key={rule.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-1.5 rounded-full ${
                        rule.severity === "blocking" ? "bg-blocked" : "bg-caution"
                      }`}
                    />
                    <span className="font-medium">{rule.label}</span>
                  </div>
                  <p className="text-muted text-[13px] mt-0.5 leading-snug">
                    {rule.description}
                  </p>
                  <p className="text-subtle text-[11px] mt-0.5">{rule.window}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold tracking-tight mb-2">
              Check a specific pair
            </h3>
            <p className="text-sm text-muted leading-snug">
              Already have someone in mind? Test any two researchers against the
              same rules.
            </p>
            <Link
              href="/check"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-accent hover:underline underline-offset-4"
            >
              Open pair check
              <span aria-hidden="true">→</span>
            </Link>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>;
}

function Hero() {
  return (
    <div className="mb-8 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Reviewer conflict screening
      </h1>
      <p className="text-muted mt-2 leading-relaxed">
        Before a funding panel assigns a reviewer, someone has to establish that
        the reviewer is genuinely independent of the applicant. Panelgraph walks
        the collaboration graph — co-authorship, supervision, shared awards and
        overlapping posts — and shows the evidence behind every verdict.
      </p>
    </div>
  );
}
