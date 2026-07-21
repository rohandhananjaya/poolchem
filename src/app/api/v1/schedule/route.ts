import { z } from "zod/v4";
import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { apiSuccess, apiError } from "@/lib/api-keys/response";
import { getScheduleData } from "@/lib/db/schedule";
import { ValidationError } from "@/lib/errors";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  status: z
    .enum(["scheduled", "all", "cancelled", "completed", "in_progress"])
    .optional(),
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
    const { page, status, poolId, fromDate, toDate } = parsed.data;

    const { visits, total } = await getScheduleData(companyId, page, {
      status,
      poolId,
      fromDate,
      toDate,
    });
    return apiSuccess({ visits, total, page }, rateLimit);
  } catch (error) {
    return apiError(error);
  }
}
