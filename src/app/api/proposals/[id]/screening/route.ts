import { z } from "zod";
import { NotFoundError, handleRoute } from "@/lib/api";
import { screenReviewers } from "@/lib/queries/screening";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { id } = paramsSchema.parse(await context.params);
    const result = await screenReviewers(id);
    if (!result) throw new NotFoundError(`No proposal with id "${id}".`);
    return result;
  });
}
