"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { assertVisitAccess, cancelVisit, createVisit, updateVisit } from "@/lib/db/visits";
import { notifyVisitAssigned } from "@/lib/push/notify";
import * as emailNotify from "@/lib/email/notify";

/** Result returned to `useActionState` on the client. */
export interface ScheduleFormState {
  ok: boolean;
  error?: string;
}

/** Matches a `YYYY-MM-DD` value from `<input type="date">`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schedules a new DRAFT visit for one or more pools on a chosen day.
 *
 * - OWNER / SUPER_ADMIN: techId from the form (or `null` for unassigned).
 * - TECH: always self-assigned (form value is ignored — security hardening).
 */
export async function scheduleVisitAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const user = await requireTech();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const poolIds = formData
    .getAll("poolId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const date = formData.get("date");

  if (poolIds.length === 0) {
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

  // Resolve the tech id: owners/admins may assign to any company tech or leave
  // unassigned; TECH users are always forced to self-assign.
  const rawTechId = formData.get("techId");
  const techId =
    user.role === "TECH"
      ? user.id
      : typeof rawTechId === "string" && rawTechId.length > 0
        ? rawTechId
        : null;

  try {
    const visit = await createVisit(poolIds, techId, user.companyId, scheduledAt);
    if (visit.techId) {
      await notifyVisitAssigned({
        companyId: user.companyId,
        visitId: visit.id,
        techId: visit.techId,
      });
      await emailNotify.notifyVisitAssigned({
        companyId: user.companyId,
        visitId: visit.id,
        techId: visit.techId,
      });
    }
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    console.error("scheduleVisitAction:", e);
    return { ok: false, error: "Could not schedule the visit. Please try again." };
  }
}

/**
 * Cancels a visit with a required reason. Only DRAFT visits can be cancelled.
 * The caller must belong to the same company as the visit's pool.
 */
export async function cancelVisitAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const user = await requireTech();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const visitId = formData.get("visitId");
  const reason = formData.get("reason");

  if (typeof visitId !== "string" || visitId === "") {
    return { ok: false, error: "Visit ID is required." };
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return { ok: false, error: "A cancellation reason is required." };
  }

  try {
    await assertVisitAccess(visitId, user.companyId, user.id);
    const result = await cancelVisit(visitId, user.companyId, reason.trim());
    if (!result) {
      return { ok: false, error: "Visit not found." };
    }
    await emailNotify.notifyVisitCancelled({
      companyId: user.companyId,
      visitId,
      reason: reason.trim(),
    });
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    console.error("cancelVisitAction:", e);
    return { ok: false, error: "Could not cancel the visit. Please try again." };
  }
}

/**
 * Updates a visit's scheduled date and/or assigned tech. TECH users are forced
 * to self-assign; OWNER/SUPER_ADMIN may assign any company tech or unassign.
 */
export async function updateVisitAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const user = await requireTech();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const visitId = formData.get("visitId");
  if (typeof visitId !== "string" || visitId === "") {
    return { ok: false, error: "Visit ID is required." };
  }

  const date = formData.get("date");
  let scheduledAt: Date | null | undefined = undefined;
  if (typeof date === "string" && date.length > 0) {
    if (!DATE_PATTERN.test(date)) {
      return { ok: false, error: "Please choose a valid date." };
    }
    scheduledAt = new Date(`${date}T12:00:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      return { ok: false, error: "Please choose a valid date." };
    }
  }

  const rawTechId = formData.get("techId");
  const techId =
    user.role === "TECH"
      ? user.id
      : typeof rawTechId === "string" && rawTechId.length > 0
        ? rawTechId
        : null;

  try {
    const result = await updateVisit(visitId, user.companyId, {
      scheduledAt,
      techId,
    });
    if (!result) {
      return { ok: false, error: "Visit not found." };
    }
    await notifyVisitAssigned({
      companyId: user.companyId,
      visitId,
      techId: result.visit.techId,
      previousTechId: result.previousTechId,
    });
    await emailNotify.notifyVisitAssigned({
      companyId: user.companyId,
      visitId,
      techId: result.visit.techId,
      previousTechId: result.previousTechId,
    });
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    console.error("updateVisitAction:", e);
    return { ok: false, error: "Could not update the visit. Please try again." };
  }
}
