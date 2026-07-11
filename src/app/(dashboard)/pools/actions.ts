"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createPool, updatePool, deletePool, getPoolById } from "@/lib/db/pools";

export interface FormState {
  ok: boolean;
  error?: string;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

export async function createPoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const name = text(formData, "name");
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
        address: optionalText(formData, "address"),
        notes: optionalText(formData, "notes"),
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

  const poolId = text(formData, "poolId");
  if (!poolId) return { ok: false, error: "Pool ID is required." };

  const name = text(formData, "name");
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
      address: optionalText(formData, "address"),
      notes: optionalText(formData, "notes"),
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

  const poolId = text(formData, "poolId");
  if (!poolId) return { ok: false, error: "Pool ID is required." };

  const confirmName = text(formData, "confirmName");

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
