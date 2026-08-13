import { z } from "zod";

/**
 * Connection details are read from the environment and never committed.
 * See `.env.example` for the shape; `.env.local` holds the real values locally
 * and Vercel project settings hold them in production.
 */
const envSchema = z.object({
  COGNODB_URI: z
    .string()
    .min(1, "is empty")
    .refine((value) => /^(bolt|neo4j)(\+s|\+ssc)?:\/\/.+/.test(value), {
      message:
        "must be a Bolt URI, e.g. bolt+s://<instance-id>.databases.cognodb.cloud",
    }),
  COGNODB_USER: z.string().min(1, "is empty").default("cognodb"),
  COGNODB_PASSWORD: z.string().min(1, "is empty"),
  COGNODB_DATABASE: z.string().min(1, "is empty").default("neo4j"),
});

export type Env = z.infer<typeof envSchema>;

export type EnvResult =
  | { ok: true; env: Env }
  | { ok: false; problems: string[] };

let cached: EnvResult | undefined;

/**
 * Parses the environment without throwing.
 *
 * Deliberately lazy and non-throwing: a missing password should surface as a
 * readable "not configured" screen at request time, not as a crash during
 * `next build` on a machine that has no credentials.
 */
export function readEnv(): EnvResult {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    COGNODB_URI: process.env.COGNODB_URI,
    COGNODB_USER: process.env.COGNODB_USER,
    COGNODB_PASSWORD: process.env.COGNODB_PASSWORD,
    COGNODB_DATABASE: process.env.COGNODB_DATABASE,
  });

  cached = parsed.success
    ? { ok: true, env: parsed.data }
    : { ok: false, problems: parsed.error.issues.map(describe) };

  return cached;
}

/**
 * Turns a zod issue into something actionable.
 *
 * The default message for an absent variable is "expected string, received
 * undefined", which tells a reader nothing about *which* variable to set — so
 * the name is always put first and a missing value is named as such.
 */
function describe(issue: z.core.$ZodIssue): string {
  const name = String(issue.path[0] ?? "environment");
  if (issue.code === "invalid_type") return `${name} is not set`;
  return `${name} ${issue.message}`;
}

/** Test-only escape hatch so a re-read picks up changed process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
