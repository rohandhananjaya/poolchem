"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyById,
  setPoolProperty,
} from "@/lib/db/properties";
import { formText, formOptionalText } from "@/lib/utils";

const text = formText;
const optionalText = formOptionalText;

export interface FormState {
  ok: boolean;
  error?: string;
}

export async function createPropertyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const name = text(formData, "name");
  if (name === "") return { ok: false, error: "Property name is required." };

  try {
    await createProperty(
      {
        name,
        address: optionalText(formData, "address"),
        notes: optionalText(formData, "notes"),
      },
      user.companyId,
    );
    revalidatePath("/properties");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create property. Please try again." };
  }
}

export async function updatePropertyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const propertyId = text(formData, "propertyId");
  if (!propertyId) return { ok: false, error: "Property ID is required." };

  const name = text(formData, "name");
  if (name === "") return { ok: false, error: "Property name is required." };

  try {
    await updateProperty(
      propertyId,
      {
        name,
        address: optionalText(formData, "address"),
        notes: optionalText(formData, "notes"),
      },
      user.companyId,
    );
    revalidatePath("/properties");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update property. Please try again." };
  }
}

export async function deletePropertyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const propertyId = text(formData, "propertyId");
  if (!propertyId) return { ok: false, error: "Property ID is required." };

  const confirmName = text(formData, "confirmName");

  const property = await getPropertyById(propertyId, user.companyId);
  if (!property) {
    return { ok: false, error: "Property not found." };
  }

  if (confirmName !== property.name) {
    return { ok: false, error: "Property name does not match." };
  }

  try {
    await deleteProperty(propertyId, user.companyId);
    revalidatePath("/properties");
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete property. Please try again." };
  }
}

/**
 * Attaches (or detaches, when `propertyId` is `null`) a pool to a property.
 * The db helper's tenant-FK guard is the safety — a cross-tenant pool/property
 * throws, surfaced here as a clean toast error (never a raw error).
 */
export async function setPoolPropertyAction(
  poolId: string,
  propertyId: string | null,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  if (!poolId) return { ok: false, error: "Pool ID is required." };

  try {
    await setPoolProperty(poolId, propertyId, user.companyId);
    revalidatePath("/properties");
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        propertyId === null
          ? "Could not detach pool. Please try again."
          : "Could not attach pool. Please try again.",
    };
  }
}
