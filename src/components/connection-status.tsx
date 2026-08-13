"use client";

import { useEffect, useState } from "react";
import type { HealthStatus } from "@/lib/neo4j";

type State = { kind: "checking" } | { kind: "known"; health: HealthStatus };

/**
 * Live CognoDB connection indicator.
 *
 * Deliberately quiet when everything is fine — a green dot and nothing else.
 * It only expands into a readable explanation when the instance is
 * unreachable or the app has no credentials, which are the two states a
 * person actually needs to act on.
 */
export function ConnectionStatus() {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const health = (await response.json()) as HealthStatus;
        if (!cancelled) setState({ kind: "known", health });
      } catch {
        if (!cancelled) {
          setState({
            kind: "known",
            health: { ok: false, kind: "connection", reason: "unreachable" },
          });
        }
      }
    }

    void poll();
    const timer = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (state.kind === "checking") {
    return (
      <span className="flex items-center gap-2 text-xs text-subtle">
        <span className="size-1.5 rounded-full bg-subtle animate-pulse" />
        Checking
      </span>
    );
  }

  if (state.health.ok) {
    return (
      <span className="flex items-center gap-2 text-xs text-muted">
        <span className="size-1.5 rounded-full bg-clear" />
        CognoDB connected
      </span>
    );
  }

  const message =
    state.health.kind === "config"
      ? "Not configured"
      : state.health.reason === "unauthorized"
        ? "Credentials rejected"
        : state.health.reason === "timeout"
          ? "Instance not responding"
          : "Instance unreachable";

  return (
    <span className="flex items-center gap-2 text-xs font-medium text-blocked">
      <span className="size-1.5 rounded-full bg-blocked" />
      {message}
    </span>
  );
}
