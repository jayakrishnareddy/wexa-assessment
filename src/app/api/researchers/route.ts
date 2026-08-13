import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { searchResearchers } from "@/lib/queries/researchers";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  // Bounded so a pathological query string cannot turn into an expensive scan.
  query: z.string().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const { query, limit } = querySchema.parse({
      query: searchParams.get("query") ?? "",
      limit: searchParams.get("limit") ?? undefined,
    });

    return { researchers: await searchResearchers(query, limit) };
  });
}
