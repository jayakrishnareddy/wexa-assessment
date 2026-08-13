import { z } from "zod";
import { NotFoundError, handleRoute } from "@/lib/api";
import { explainPair } from "@/lib/queries/explain";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  applicantId: z.string().min(1).max(64),
  candidateId: z.string().min(1).max(64),
});

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const { applicantId, candidateId } = querySchema.parse({
      applicantId: searchParams.get("applicantId"),
      candidateId: searchParams.get("candidateId"),
    });

    const explanation = await explainPair(applicantId, candidateId);
    if (!explanation) {
      throw new NotFoundError("One or both researchers could not be found.");
    }
    return explanation;
  });
}
