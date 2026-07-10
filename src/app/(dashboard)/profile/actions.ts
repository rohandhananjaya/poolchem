"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { updateCompany } from "@/lib/db/company";
import { updateUser } from "@/lib/db/users";

/** Result returned to `useActionState` on the client. */
export interface FormState {
  ok: boolean;
  error?: string;
}

/** Reads a required, trimmed text field from a form; returns "" when absent. */
function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads an optional text field: trimmed string, or `null` when empty. */
function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/** Updates the signed-in user's own account (name only). */
export async function updateAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAuth();

  const name = text(formData, "name");
  if (name === "") {
    return { ok: false, error: "Name is required." };
  }

  try {
    await updateUser(user.id, user.companyId, { name });
    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update your account. Please try again." };
  }
}

/** Updates the company profile. Restricted to company owners. */
export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAuth();
  if (user.role !== "OWNER") {
    return { ok: false, error: "Only company owners can edit company details." };
  }

  const name = text(formData, "name");
  const email = text(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  try {
    await updateCompany(user.companyId, {
      name,
      email,
      phone: optionalText(formData, "phone"),
      address: optionalText(formData, "address"),
    });
    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update company details. Please try again." };
  }
}
