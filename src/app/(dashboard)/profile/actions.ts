"use server";

import { revalidatePath } from "next/cache";

import { requireAuth, requireOwner } from "@/lib/auth";
import { updateCompany } from "@/lib/db/company";
import { updateUser } from "@/lib/db/users";
import { createClient } from "@/lib/supabase/server";

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
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
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

/** Updates the password for the signed-in user via Supabase Auth. */
export async function updatePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAuth();

  const currentPassword = text(formData, "currentPassword");
  const newPassword = text(formData, "newPassword");
  const confirmPassword = text(formData, "confirmPassword");

  if (!currentPassword) {
    return { ok: false, error: "Current password is required." };
  }
  if (!newPassword) {
    return { ok: false, error: "New password is required." };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New passwords do not match." };
  }

  try {
    const supabase = await createClient();

    // Verify current password by attempting to sign in.
    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

    if (signInError) {
      return { ok: false, error: "Current password is incorrect." };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update password. Please try again." };
  }
}
