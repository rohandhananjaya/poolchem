import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { apiSuccess, apiError } from "@/lib/api-keys/response";
import { getVisitById } from "@/lib/db/visits";
import { NotFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ visitId: string }> },
) {
  try {
    const { companyId, rateLimit } = await authenticateApiKey(request);
    const { visitId } = await ctx.params;
    const visit = await getVisitById(visitId, companyId);
    if (!visit) throw new NotFoundError("Visit not found.");
    return apiSuccess({ visit }, rateLimit);
  } catch (error) {
    return apiError(error);
  }
}
