import { ConfigurationError, DatabaseUnavailableError } from "./neo4j";

/**
 * Result of a server-side data load that is allowed to fail.
 *
 * Server Components fetch directly from the query layer rather than through
 * the app's own HTTP API — one less round trip, and the page renders with data
 * already in place. The trade-off is that a driver error would otherwise
 * become a 500 error page, so every page load goes through this wrapper and
 * renders a real explanation instead.
 */
export type Loaded<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "config" | "connection" | "unknown";
      message: string;
      details?: string[];
    };

export async function load<T>(work: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return {
        ok: false,
        kind: "config",
        message:
          "The application has no CognoDB connection details, so there is nothing to show yet.",
        details: error.problems,
      };
    }
    if (error instanceof DatabaseUnavailableError) {
      return { ok: false, kind: "connection", message: error.message };
    }

    console.error("Server data load failed:", error);
    return {
      ok: false,
      kind: "unknown",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while querying the graph.",
    };
  }
}
