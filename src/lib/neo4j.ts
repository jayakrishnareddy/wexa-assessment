import neo4j, { type Driver, type RecordShape } from "neo4j-driver";
import { readEnv } from "./env";

/** The app is misconfigured — missing or malformed environment variables. */
export class ConfigurationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`CognoDB is not configured: ${problems.join("; ")}`);
    this.name = "ConfigurationError";
    this.problems = problems;
  }
}

/** The database could not be reached, or rejected our credentials. */
export class DatabaseUnavailableError extends Error {
  readonly reason: "unreachable" | "unauthorized" | "timeout";

  constructor(reason: DatabaseUnavailableError["reason"], cause?: unknown) {
    super(
      {
        unreachable: "Could not reach the CognoDB instance.",
        unauthorized: "CognoDB rejected the supplied credentials.",
        timeout: "The CognoDB instance did not respond in time.",
      }[reason],
      { cause },
    );
    this.name = "DatabaseUnavailableError";
    this.reason = reason;
  }
}

/**
 * One driver per process, cached on `globalThis`.
 *
 * The driver owns a TCP connection pool, so creating one per request would
 * exhaust the free tier's 200-connection budget almost immediately. Stashing it
 * on `globalThis` also survives Next.js dev hot-reloads, which otherwise leak a
 * fresh pool on every file save.
 */
const globalForDriver = globalThis as unknown as {
  __cognodbDriver?: Driver;
};

export function getDriver(): Driver {
  if (globalForDriver.__cognodbDriver) return globalForDriver.__cognodbDriver;

  const result = readEnv();
  if (!result.ok) throw new ConfigurationError(result.problems);

  const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = result.env;

  globalForDriver.__cognodbDriver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD),
    {
      // A c0 instance allows 200 connections in total. Serverless means many
      // short-lived instances of this process, so each one stays modest.
      maxConnectionPoolSize: 10,
      connectionAcquisitionTimeout: 10_000,
      connectionTimeout: 10_000,
      maxTransactionRetryTime: 8_000,
      // Counts and hop distances come back as plain JS numbers instead of
      // driver `Integer` objects, so results serialise straight to JSON.
      disableLosslessIntegers: true,
    },
  );

  return globalForDriver.__cognodbDriver;
}

export function getDatabase(): string {
  const result = readEnv();
  if (!result.ok) throw new ConfigurationError(result.problems);
  return result.env.COGNODB_DATABASE;
}

/**
 * Maps driver-level failures onto our own error types so callers (and the UI)
 * can distinguish "the database is down" from "this query is wrong".
 */
function translateError(error: unknown): never {
  if (error instanceof ConfigurationError) throw error;

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code.includes("Unauthorized") || code.includes("AuthenticationRate")) {
    throw new DatabaseUnavailableError("unauthorized", error);
  }
  if (code === "ServiceUnavailable" || code === "SessionExpired") {
    throw new DatabaseUnavailableError("unreachable", error);
  }
  if (code.includes("Timeout") || code === "Neo.ClientError.Transaction.LockClientStopped") {
    throw new DatabaseUnavailableError("timeout", error);
  }

  throw error;
}

/** Transient conditions worth retrying: the query itself is not at fault. */
function isRetryable(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return (
    code === "ServiceUnavailable" ||
    code === "SessionExpired" ||
    code.startsWith("Neo.TransientError")
  );
}

const READ_ATTEMPTS = 3;

/**
 * Runs a read query and returns plain row objects.
 *
 * `params` is always passed to the driver separately from the Cypher text —
 * the server parses the statement once and binds values, so user input can
 * never be interpreted as query structure.
 *
 * Reads use an auto-commit statement rather than `session.executeRead()`. A
 * managed transaction costs three extra network round trips (BEGIN, COMMIT and
 * the retry bookkeeping around them) to buy automatic retries; measured
 * against this instance at ~280 ms RTT that overhead was 600 ms on *every*
 * query — `RETURN 1` took 866 ms managed versus 270 ms auto-commit. These
 * reads are idempotent, so the retry is cheaper to do here directly, and the
 * transactional guarantees a managed read transaction adds are worth nothing
 * to a single read-only statement. Writes still go through `executeWrite`,
 * where those guarantees do matter.
 */
export async function runRead<T extends RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    const session = getDriver().session({
      database: getDatabase(),
      defaultAccessMode: neo4j.session.READ,
    });

    try {
      const result = await session.run<T>(cypher, params);
      return result.records.map((record) => record.toObject());
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === READ_ATTEMPTS) break;
      // Back off briefly so a momentary blip is not hammered.
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    } finally {
      await session.close();
    }
  }

  translateError(lastError);
}

/** Write counterpart to {@link runRead}, used by the seed script. */
export async function runWrite<T extends RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = getDriver().session({
    database: getDatabase(),
    defaultAccessMode: neo4j.session.WRITE,
  });

  try {
    const result = await session.executeWrite((tx) => tx.run<T>(cypher, params));
    return result.records.map((record) => record.toObject());
  } catch (error) {
    translateError(error);
  } finally {
    await session.close();
  }
}

export type HealthStatus =
  | { ok: true }
  | { ok: false; kind: "config"; problems: string[] }
  | { ok: false; kind: "connection"; reason: DatabaseUnavailableError["reason"] };

/** Cheap liveness probe used by the UI to render an honest connection banner. */
export async function checkHealth(): Promise<HealthStatus> {
  try {
    await getDriver().verifyConnectivity({ database: getDatabase() });
    return { ok: true };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return { ok: false, kind: "config", problems: error.problems };
    }
    try {
      translateError(error);
    } catch (translated) {
      if (translated instanceof DatabaseUnavailableError) {
        return { ok: false, kind: "connection", reason: translated.reason };
      }
    }
    return { ok: false, kind: "connection", reason: "unreachable" };
  }
}

export async function closeDriver(): Promise<void> {
  await globalForDriver.__cognodbDriver?.close();
  globalForDriver.__cognodbDriver = undefined;
}
