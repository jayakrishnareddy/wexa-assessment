import { handleRoute } from "@/lib/api";
import { getGraphStats } from "@/lib/queries/researchers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => getGraphStats());
}
