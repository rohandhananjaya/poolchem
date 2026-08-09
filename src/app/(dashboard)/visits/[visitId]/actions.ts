"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import {
  assertVisitAccess,
  cancelVisit,
  claimReportNotification,
  completeVisit,
  releaseReportNotification,
  saveDraftVisit,
  startVisit,
  updateVisitStatus,
  type VisitReadings,
  type VisitChemical,
} from "@/lib/db/visits";
import { readingsSchema, type ReadingsInput } from "@/lib/validation/visit-readings";
import { ServiceVisitStatus } from "@/generated/prisma/client";
import * as emailNotify from "@/lib/email/notify";

export interface VisitFormValues {
  readings: ReadingsInput;
  chemicals: VisitChemical[];
  notes: string;
  /** YYYY-MM-DD string, or undefined to leave unset. */
  nextServiceDate?: string;
  /** Device-generated idempotency key for offline replay. Optional. */
  clientMutationId?: string;
  /**
   * Revision the client believes it last wrote against. `completeVisitAction`
   * forwards it so the server rejects a racing completion from another device.
   */
  expectedVersion?: number;
}

/**
 * Coerces the optional readings shape (`ReadingsInput`) into the required
 * `VisitReadings` shape the db/ helpers persist. Blank fields on the form or a
 * partially-filled offline draft are normalized to 0 here — at the server
 * boundary — so online and replayed-offline behavior are identical and the
 * local draft stays a faithful record of what the tech entered.
 */
function normalizeReadings(readings: ReadingsInput): VisitReadings {
  return {
    ph: readings.ph ?? 0,
    freeChlorine: readings.freeChlorine ?? 0,
    totalAlkalinity: readings.totalAlkalinity ?? 0,
    calciumHardness: readings.calciumHardness ?? 0,
    cyanuricAcid: readings.cyanuricAcid ?? 0,
    temperature: readings.temperature ?? 0,
  };
}

export async function saveDraftAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");
  readingsSchema.parse(data.readings);
  const readings = normalizeReadings(data.readings);

  await assertVisitAccess(visitId, user.companyId, user.id);
  const saved = await saveDraftVisit(
    visitId,
    readings,
    data.chemicals,
    data.notes || null,
    data.nextServiceDate ? new Date(`${data.nextServiceDate}T12:00:00`) : null,
    {
      clientMutationId: data.clientMutationId,
      expectedVersion: data.expectedVersion,
    },
  );
  revalidatePath(`/visits/${visitId}`);
  // The client re-bases its known revision from this so a later completion
  // (with the freshly-returned `expectedVersion`) isn't falsely rejected.
  return { version: saved?.visit?.version };
}

export async function completeVisitAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");
  readingsSchema.parse(data.readings);
  const readings = normalizeReadings(data.readings);

  await assertVisitAccess(visitId, user.companyId, user.id);
  const completed = await completeVisit(
    visitId,
    readings,
    data.chemicals,
    data.notes || null,
    data.nextServiceDate ? new Date(`${data.nextServiceDate}T12:00:00`) : null,
    {
      clientMutationId: data.clientMutationId,
      expectedVersion: data.expectedVersion,
    },
  );

  // Auto-send the shareable report to the pool's homeowner when one is set.
  // Claim-then-send: completeVisit no longer stamps reportNotifiedAt, so a crash
  // between commit and a successful send no longer silences the email forever.
  // Fire on any write — fresh or replayed — whose slot is still null, atomically
  // claim it so a concurrent retry can't double-email, then release the claim on
  // a confirmed send failure so a later retry re-attempts delivery.
  const homeownerEmail = completed.visit?.pool.homeownerEmail;
  const alreadyNotified = Boolean(completed.visit?.reportNotifiedAt);
  if (homeownerEmail && !alreadyNotified) {
    const claimed = await claimReportNotification(visitId, user.companyId);
    if (claimed) {
      try {
        const result = await emailNotify.notifyReportAvailable({
          companyId: user.companyId,
          visitId,
          to: homeownerEmail,
        });
        if (!result.ok) {
          await releaseReportNotification(visitId, user.companyId);
        }
      } catch {
        // notifyReportAvailable's pre-send DB reads can throw before safeSend
        // runs; a throw means no email went out, so release for a retry.
        await releaseReportNotification(visitId, user.companyId);
      }
    }
  }

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/schedule");
  return { version: completed.visit?.version };
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
  await emailNotify.notifyVisitCancelled({
    companyId: user.companyId,
    visitId,
    reason,
  });
  revalidatePath(`/visits/${visitId}`);
}
