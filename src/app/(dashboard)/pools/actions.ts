"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createPool, updatePool, deletePool, getPoolById } from "@/lib/db/pools";
import { formText, formOptionalText } from "@/lib/utils";

const text = formText;
const optionalText = formOptionalText;

export interface FormState {
  ok: boolean;
  error?: string;
}

export async function createPoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const name = formText(formData, "name");
  if (name === "") return { ok: false, error: "Pool name is required." };

  const volumeRaw = formData.get("volume");
  const volume =
    typeof volumeRaw === "string" ? Number.parseInt(volumeRaw, 10) : NaN;
  if (Number.isNaN(volume) || volume < 1) {
    return { ok: false, error: "Volume must be a positive number." };
  }

  try {
    await createPool(
      {
        name,
        volume,
        address: formOptionalText(formData, "address"),
        notes: formOptionalText(formData, "notes"),
      },
      user.companyId,
    );
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create pool. Please try again." };
  }
}

export async function updatePoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const poolId = formText(formData, "poolId");
  if (!poolId) return { ok: false, error: "Pool ID is required." };

  const name = formText(formData, "name");
  if (name === "") return { ok: false, error: "Pool name is required." };

  const volumeRaw = formData.get("volume");
  const volume =
    typeof volumeRaw === "string" ? Number.parseInt(volumeRaw, 10) : NaN;
  if (Number.isNaN(volume) || volume < 1) {
    return { ok: false, error: "Volume must be a positive number." };
  }

  const isActive = formData.get("isActive") === "on";

  try {
    await updatePool(poolId, {
      name,
      volume,
      address: formOptionalText(formData, "address"),
      notes: formOptionalText(formData, "notes"),
      isActive,
    }, user.companyId);
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update pool. Please try again." };
  }
}

export async function deletePoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const poolId = formText(formData, "poolId");
  if (!poolId) return { ok: false, error: "Pool ID is required." };

  const confirmName = formText(formData, "confirmName");

  const pool = await getPoolById(poolId, user.companyId);
  if (!pool) {
    return { ok: false, error: "Pool not found." };
  }

  if (confirmName !== pool.name) {
    return { ok: false, error: "Pool name does not match." };
  }

  try {
    await deletePool(poolId, user.companyId);
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete pool. Please try again." };
  }
}
