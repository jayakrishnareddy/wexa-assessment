import type { ReactNode } from "react";
import type { Verdict } from "@/lib/domain";

const VERDICT_STYLES: Record<Verdict, { label: string; className: string }> = {
  clear: {
    label: "Eligible",
    className: "bg-clear-soft text-clear border-[var(--clear-border)]",
  },
  caution: {
    label: "Review with care",
    className: "bg-caution-soft text-caution border-[var(--caution-border)]",
  },
  blocked: {
    label: "Conflicted",
    className: "bg-blocked-soft text-blocked border-[var(--blocked-border)]",
  },
};

export function VerdictBadge({
  verdict,
  size = "md",
}: {
  verdict: Verdict;
  size?: "sm" | "md";
}) {
  const style = VERDICT_STYLES[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      } ${style.className}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-2xl font-semibold tracking-tight mt-0.5">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {hint ? <div className="text-xs text-subtle mt-0.5">{hint}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border-subtle bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted mt-0.5">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Shown when a query succeeded but there is genuinely nothing to display. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-muted/50 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted mt-1 max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Shown when the database could not be reached or the app is unconfigured.
 *
 * Distinguishing the two matters: one is fixed by starting the instance, the
 * other by setting environment variables, and telling someone the wrong one
 * costs them an afternoon.
 */
export function DatabaseErrorState({
  kind,
  message,
  details,
}: {
  kind: "config" | "connection" | "unknown";
  message: string;
  details?: string[];
}) {
  return (
    <div className="rounded-xl border border-[var(--blocked-border)] bg-blocked-soft px-6 py-8">
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 20 20"
          className="size-5 shrink-0 mt-0.5 text-blocked"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4.5a.75.75 0 0 0-1.5 0v4.25a.75.75 0 0 0 1.5 0V6.5ZM10 14.25a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0">
          <p className="font-medium text-blocked">
            {kind === "config"
              ? "Not connected to CognoDB"
              : "CognoDB is unreachable"}
          </p>
          <p className="text-sm text-muted mt-1">{message}</p>

          {details && details.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {details.map((detail) => (
                <li key={detail} className="flex gap-2">
                  <span className="text-subtle">•</span>
                  <span className="font-mono text-xs pt-0.5">{detail}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-sm text-muted mt-3">
            {kind === "config" ? (
              <>
                Copy <code className="font-mono text-xs">.env.example</code> to{" "}
                <code className="font-mono text-xs">.env.local</code> and fill in
                the connection details from your CognoDB console.
              </>
            ) : (
              <>
                Check that the instance is running at{" "}
                <a
                  href="https://console.cognodb.com"
                  className="text-accent underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  console.cognodb.com
                </a>
                , then reload.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-muted ${className}`}
      aria-hidden="true"
    />
  );
}
