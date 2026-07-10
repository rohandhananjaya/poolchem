"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { createVisit } from "@/lib/db/visits";

/** Result returned to `useActionState` on the client. */
export interface ScheduleFormState {
  ok: boolean;
  error?: string;
}

/** Matches a `YYYY-MM-DD` value from `<input type="date">`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schedules a new DRAFT visit for a pool on a chosen day, assigned to the
 * signed-in user as the servicing tech.
 */
export async function scheduleVisitAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const user = await requireTech();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const poolId = formData.get("poolId");
  const date = formData.get("date");

  if (typeof poolId !== "string" || poolId === "") {
    return { ok: false, error: "Please choose a pool." };
  }
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) {
    return { ok: false, error: "Please choose a valid date." };
  }

  // Interpret the date at local noon so the visit lands on the intended day
  // regardless of timezone offset.
  const scheduledAt = new Date(`${date}T12:00:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Please choose a valid date." };
  }

  try {
    await createVisit(poolId, user.id, user.companyId, scheduledAt);
    revalidatePath("/schedule");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not schedule the visit. Please try again." };
  }
}
