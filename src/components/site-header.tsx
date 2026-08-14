import Link from "next/link";
import { ConnectionStatus } from "./connection-status";
import { TourButton } from "./tour-button";

const NAV = [
  { href: "/", label: "Proposals" },
  { href: "/check", label: "Pair check" },
  { href: "/model", label: "Data model" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border-subtle bg-surface/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <GraphMark />
          <span className="font-semibold tracking-tight">Panelgraph</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.href === "/check" ? "pair-check" : undefined}
              className="px-2.5 py-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <TourButton />
          <ConnectionStatus />
        </div>
      </div>
    </header>
  );
}

/** Three nodes and two edges — the smallest drawing of a conflict path. */
function GraphMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-accent"
    >
      <path
        d="M6 7.5 L18 5 M6 7.5 L15 18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="6" cy="7.5" r="3" fill="currentColor" />
      <circle cx="18" cy="5" r="2.2" fill="currentColor" opacity="0.75" />
      <circle cx="15" cy="18" r="2.2" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
