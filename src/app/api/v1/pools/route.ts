import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { apiSuccess, apiError } from "@/lib/api-keys/response";
import { getPoolsByCompany } from "@/lib/db/pools";

export async function GET(request: NextRequest) {
  try {
    const { companyId, rateLimit } = await authenticateApiKey(request);
    const pools = await getPoolsByCompany(companyId);
    return apiSuccess({ pools }, rateLimit);
  } catch (error) {
    return apiError(error);
  }
}
