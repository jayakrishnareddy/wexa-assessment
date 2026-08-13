import Link from "next/link";
import type { Metadata } from "next";
import { screenReviewers } from "@/lib/queries/screening";
import { load } from "@/lib/server-data";
import { DatabaseErrorState } from "@/components/ui";
import { ScreeningWorkspace } from "@/components/screening-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Screening ${id}` };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await load(() => screenReviewers(id));

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <BackLink />
        <DatabaseErrorState
          kind={result.kind}
          message={result.message}
          details={result.details}
        />
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <BackLink />
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-muted/50 px-6 py-12 text-center">
          <p className="font-medium">Proposal not found</p>
          <p className="text-sm text-muted mt-1">
            No proposal in the graph has the reference{" "}
            <code className="font-mono text-xs">{id}</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <BackLink />
      <ScreeningWorkspace result={result.data} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6"
    >
      <span aria-hidden="true">←</span> All proposals
    </Link>
  );
}
