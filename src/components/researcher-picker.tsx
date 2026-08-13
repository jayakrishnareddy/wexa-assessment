"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ResearcherSummary } from "@/lib/types";
import { Skeleton } from "./ui";

/**
 * Type-ahead researcher search.
 *
 * Queries are debounced and each keystroke aborts the previous request, so a
 * fast typist does not queue up a series of searches whose results arrive out
 * of order and overwrite one another.
 */
export function ResearcherPicker({
  label,
  selected,
  onSelect,
  excludeId,
}: {
  label: string;
  selected: ResearcherSummary | null;
  onSelect: (researcher: ResearcherSummary | null) => void;
  excludeId?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearcherSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/researchers?query=${encodeURIComponent(query)}&limit=20`,
          { signal: controller.signal, cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok) {
          setError(body?.error?.message ?? "Search failed.");
          setResults([]);
          return;
        }
        setResults(body.researchers as ResearcherSummary[]);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(
          fetchError instanceof Error ? fetchError.message : "Search failed.",
        );
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const visible = (results ?? []).filter(
    (researcher) => researcher.id !== excludeId,
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs text-subtle block mb-1.5">{label}</label>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{selected.name}</div>
            <div className="text-xs text-muted truncate">
              {selected.seniority}
              {selected.institution ? ` · ${selected.institution}` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-xs text-muted hover:text-foreground shrink-0 transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by name…"
          className="w-full text-sm rounded-lg border border-border-subtle bg-surface px-3 py-2.5 outline-none focus:border-accent transition-colors"
        />
      )}

      {open && !selected ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border-subtle bg-surface shadow-lg"
        >
          {loading && results === null ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-blocked">{error}</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">
              No researcher matches “{query}”.
            </p>
          ) : (
            <ul>
              {visible.map((researcher) => (
                <li key={researcher.id}>
                  <button
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onSelect(researcher);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-muted transition-colors"
                  >
                    <div className="text-sm font-medium">{researcher.name}</div>
                    <div className="text-xs text-muted">
                      {researcher.seniority}
                      {researcher.institution ? ` · ${researcher.institution}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
