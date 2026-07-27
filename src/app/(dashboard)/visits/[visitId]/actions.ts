"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import {
  assertVisitAccess,
  cancelVisit,
  completeVisit,
  saveDraftVisit,
  startVisit,
  updateVisitStatus,
  type VisitReadings,
  type VisitChemical,
} from "@/lib/db/visits";
import { readingsSchema } from "@/lib/validation/visit-readings";
import { ServiceVisitStatus } from "@/generated/prisma/client";

export interface VisitFormValues {
  readings: VisitReadings;
  chemicals: VisitChemical[];
  notes: string;
  /** YYYY-MM-DD string, or undefined to leave unset. */
  nextServiceDate?: string;
}

export async function saveDraftAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");
  readingsSchema.parse(data.readings);

  await assertVisitAccess(visitId, user.companyId, user.id);
  await saveDraftVisit(
    visitId,
    data.readings,
    data.chemicals,
    data.notes || null,
    data.nextServiceDate ? new Date(`${data.nextServiceDate}T12:00:00`) : null,
  );
  revalidatePath(`/visits/${visitId}`);
}

export async function completeVisitAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");
  readingsSchema.parse(data.readings);

  await assertVisitAccess(visitId, user.companyId, user.id);
  await completeVisit(
    visitId,
    data.readings,
    data.chemicals,
    data.notes || null,
    data.nextServiceDate ? new Date(`${data.nextServiceDate}T12:00:00`) : null,
  );
  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/schedule");
}

/**
 * Sets a DRAFT visit to IN_PROGRESS. Returns `{ ok: true }` on success;
 * the client navigates to the visit form.
 */
export async function startVisitAction(visitId: string) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  const result = await startVisit(visitId, user.companyId, user.id);
  if (!result) throw new Error("Visit not found or already started.");
  revalidatePath(`/visits/${visitId}`);
}

/**
 * Updates a visit's status from a dropdown. Only valid transitions
 * enforced server side.
 */
export async function updateVisitStatusAction(
  visitId: string,
  status: ServiceVisitStatus,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  await assertVisitAccess(visitId, user.companyId, user.id);
  const result = await updateVisitStatus(visitId, user.companyId, status);
  if (!result) throw new Error("Visit not found.");
  revalidatePath(`/visits/${visitId}`);
}

export async function cancelVisitAction(visitId: string, reason: string) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  await assertVisitAccess(visitId, user.companyId, user.id);
  const result = await cancelVisit(visitId, user.companyId, reason);
  if (!result) throw new Error("Visit not found.");
  revalidatePath(`/visits/${visitId}`);
}
