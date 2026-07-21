import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { apiSuccess, apiError } from "@/lib/api-keys/response";
import { getPoolById } from "@/lib/db/pools";
import { NotFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ poolId: string }> },
) {
  try {
    const { companyId, rateLimit } = await authenticateApiKey(request);
    const { poolId } = await ctx.params;
    const pool = await getPoolById(poolId, companyId);
    if (!pool) throw new NotFoundError("Pool not found.");
    return apiSuccess({ pool }, rateLimit);
  } catch (error) {
    return apiError(error);
  }
}
