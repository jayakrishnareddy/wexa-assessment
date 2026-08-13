import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConfigurationError, DatabaseUnavailableError } from "./neo4j";

/**
 * Every failure the client can encounter, named.
 *
 * The UI switches on `kind` to decide what to render — a "database is
 * unreachable" banner is a very different experience from a validation error,
 * and neither should surface as a blank page or a stack trace.
 */
export type ApiErrorKind =
  | "config"
  | "connection"
  | "validation"
  | "not-found"
  | "internal";

export interface ApiErrorBody {
  error: {
    kind: ApiErrorKind;
    message: string;
    /** Populated for configuration and validation failures. */
    details?: string[];
  };
}

/** Thrown by a route when the requested record does not exist. */
export class NotFoundError extends Error {
  constructor(message = "The requested record does not exist.") {
    super(message);
    this.name = "NotFoundError";
  }
}

const STATUS_BY_KIND: Record<ApiErrorKind, number> = {
  config: 503,
  connection: 503,
  validation: 400,
  "not-found": 404,
  internal: 500,
};

export function apiError(
  kind: ApiErrorKind,
  message: string,
  details?: string[],
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { kind, message, ...(details ? { details } : {}) } },
    { status: STATUS_BY_KIND[kind] },
  );
}

/**
 * Wraps a route handler so no unexpected throw escapes as an opaque 500.
 *
 * Route handlers stay focused on the happy path; translation of driver and
 * validation errors happens once, here.
 */
export async function handleRoute<T>(
  work: () => Promise<T>,
): Promise<NextResponse<T | ApiErrorBody>> {
  try {
    return NextResponse.json(await work());
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return apiError(
        "config",
        "The application is not connected to a CognoDB instance.",
        error.problems,
      );
    }
    if (error instanceof DatabaseUnavailableError) {
      return apiError("connection", error.message);
    }
    if (error instanceof NotFoundError) {
      return apiError("not-found", error.message);
    }
    if (error instanceof ZodError) {
      return apiError(
        "validation",
        "The request parameters were not valid.",
        error.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`),
      );
    }

    console.error("Unhandled API error:", error);
    return apiError("internal", "Something went wrong handling this request.");
  }
}
