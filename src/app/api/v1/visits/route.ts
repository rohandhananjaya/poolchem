import { z } from "zod/v4";
import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { apiSuccess, apiError } from "@/lib/api-keys/response";
import { getCompanyReportData } from "@/lib/db/reports";
import { ValidationError } from "@/lib/errors";

/**
 * Query params for the list endpoint — a fresh untrusted-input boundary (no
 * server-only form/action guarding it), so page/date values are validated and
 * clamped rather than passed straight to the `db/` helper.
 */
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  poolId: z.string().trim().min(1).optional(),
  fromDate: z.iso.date().optional(),
  toDate: z.iso.date().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { companyId, rateLimit } = await authenticateApiKey(request);

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid query parameters.");
    }
    const { page, poolId, fromDate, toDate } = parsed.data;

    const { recentVisits, total } = await getCompanyReportData(companyId, page, {
      poolId,
      fromDate,
      toDate,
    });
    return apiSuccess({ visits: recentVisits, total, page }, rateLimit);
  } catch (error) {
    return apiError(error);
  }
}
