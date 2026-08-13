import { handleRoute } from "@/lib/api";
import { listProposals } from "@/lib/queries/proposals";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => ({ proposals: await listProposals() }));
}
