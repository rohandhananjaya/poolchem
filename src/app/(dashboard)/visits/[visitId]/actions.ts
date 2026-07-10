"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import {
  completeVisit,
  saveDraftVisit,
  type VisitReadings,
  type VisitChemical,
} from "@/lib/db/visits";

export interface VisitFormValues {
  readings: VisitReadings;
  chemicals: VisitChemical[];
  notes: string;
}

export async function saveDraftAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await saveDraftVisit(visitId, data.readings, data.chemicals, data.notes || null);
  revalidatePath(`/visits/${visitId}`);
}

export async function completeVisitAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await completeVisit(visitId, data.readings, data.chemicals, data.notes || null);
  revalidatePath(`/visits/${visitId}`);
  redirect(`/visits/${visitId}`);
}
