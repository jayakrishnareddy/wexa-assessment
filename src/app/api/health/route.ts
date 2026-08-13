import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/neo4j";

// Always evaluated per request: the answer is about the live instance, and
// caching it would defeat the point of a health check.
export const dynamic = "force-dynamic";

/**
 * Reports connectivity without throwing.
 *
 * Returns 200 with `{ ok: false }` rather than an error status — the UI polls
 * this to decide whether to show the "database unreachable" banner, and a
 * failed fetch would be indistinguishable from the app itself being down.
 */
export async function GET() {
  const health = await checkHealth();
  return NextResponse.json(health);
}
