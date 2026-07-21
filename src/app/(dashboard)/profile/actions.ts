"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { requireAuth, requireOwner } from "@/lib/auth";
import { updateCompany } from "@/lib/db/company";
import { getCompanyPackage } from "@/lib/db/packages";
import { checkFeatureAccess } from "@/lib/package-features";
import {
  updateUser,
  deleteUser,
  getUserExportData,
  type UserExportData,
} from "@/lib/db/users";
import { createClient } from "@/lib/supabase/server";
import { formText, formOptionalText } from "@/lib/utils";

const text = formText;
const optionalText = formOptionalText;

/** Result returned to `useActionState` on the client. */
export interface FormState {
  ok: boolean;
  error?: string;
}

/** Updates the signed-in user's own account (name only). */
export async function updateAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAuth();

  const name = formText(formData, "name");
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

  const name = formText(formData, "name");
  const email = formText(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  const companyPackage = await getCompanyPackage(user.companyId);
  const canEditBranding =
    !!companyPackage && checkFeatureAccess(companyPackage, "custom_branding");

  try {
    await updateCompany(user.companyId, {
      name,
      email,
      phone: formOptionalText(formData, "phone"),
      address: formOptionalText(formData, "address"),
      ...(canEditBranding
        ? { logo: formOptionalText(formData, "logo") }
        : {}),
    });
    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update company details. Please try again." };
  }
}

/**
 * Deletes the signed-in user's account (GDPR right to erasure, Art. 17).
 * Removes the Prisma User record and, if the service role key is configured,
 * also deletes the Supabase Auth user.
 *
 * After calling this, the client should sign the user out and redirect to /login.
 */
export async function deleteAccountAction(
  _prev: FormState,
): Promise<FormState> {
  const user = await requireAuth();

  try {
    // 1. Delete the Supabase Auth user (best-effort — requires SERVICE_ROLE_KEY).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      try {
        // We need the Supabase Auth UID, which is not stored in Prisma. Fetch it
        // from the current session before the Prisma user is deleted.
        const supabase = await createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser?.id) {
          const admin = createAdminClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await admin.auth.admin.deleteUser(authUser.id);
        }
      } catch {
        // Non-critical — the Prisma record carries the personal data.
      }
    }

    // 2. Delete the Prisma User record (personal data).
    await deleteUser(user.id, user.companyId);

    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not delete your account. Please try again.",
    };
  }
}

/**
 * Exports all of the signed-in user's data in a structured format (GDPR right
 * to data portability, Art. 20). Returns the JSON payload via the `data` field.
 */
export async function exportDataAction(): Promise<
  FormState & { data?: UserExportData }
> {
  const user = await requireAuth();

  try {
    const data = await getUserExportData(user.id, user.companyId);
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "Could not export your data. Please try again.",
    };
  }
}

/** Updates the password for the signed-in user via Supabase Auth. */
export async function updatePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAuth();

  const currentPassword = formText(formData, "currentPassword");
  const newPassword = formText(formData, "newPassword");
  const confirmPassword = formText(formData, "confirmPassword");

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
