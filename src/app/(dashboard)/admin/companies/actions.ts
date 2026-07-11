"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { requireSuperAdmin } from "@/lib/auth";
import { createCompany, deleteCompany, getCompanyById, updateCompany } from "@/lib/db/company";
import { createUser, deleteUser, updateUser, updateUserRole } from "@/lib/db/users";
import type { UserRole } from "@/generated/prisma/client";

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

export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const companyId = text(formData, "companyId");
  if (!companyId) {
    return { ok: false, error: "Company ID is required." };
  }

  const name = text(formData, "name");
  const email = text(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  const subscriptionStatus = optionalText(formData, "subscriptionStatus");
  const active = formData.get("active") === "on";

  try {
    await updateCompany(companyId, {
      name,
      email,
      phone: optionalText(formData, "phone"),
      address: optionalText(formData, "address"),
      subscriptionStatus,
      active,
    });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update company. Please try again." };
  }
}

export async function createCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const name = text(formData, "name");
  const email = text(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  try {
    await createCompany({
      name,
      email,
      phone: optionalText(formData, "phone"),
      address: optionalText(formData, "address"),
    });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create company. Please try again." };
  }
}

export async function deleteCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const companyId = text(formData, "companyId");
  if (!companyId) {
    return { ok: false, error: "Company ID is required." };
  }

  const confirmName = text(formData, "confirmName");

  const company = await getCompanyById(companyId);
  if (!company) {
    return { ok: false, error: "Company not found." };
  }

  if (confirmName !== company.name) {
    return { ok: false, error: "Company name does not match." };
  }

  try {
    await deleteCompany(companyId);
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete company. Please try again." };
  }
}

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const companyId = text(formData, "companyId");
  const name = text(formData, "name");
  const email = text(formData, "email");
  const role = text(formData, "role") as UserRole;
  const password = text(formData, "password");

  if (!companyId) return { ok: false, error: "Company ID is required." };
  if (name === "") return { ok: false, error: "Name is required." };
  if (email === "") return { ok: false, error: "Email is required." };
  if (!["OWNER", "TECH"].includes(role)) {
    return { ok: false, error: "Role must be OWNER or TECH." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        if (/already been registered|already exists/i.test(authError.message)) {
          return { ok: false, error: "A user with this email already exists." };
        }
        return { ok: false, error: `Failed to create auth user: ${authError.message}` };
      }
    }

    await createUser({ name, email, role, companyId });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create user. Please try again." };
  }
}

export async function updateUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const userId = text(formData, "userId");
  const companyId = text(formData, "companyId");
  const name = text(formData, "name");

  if (!userId) return { ok: false, error: "User ID is required." };
  if (name === "") return { ok: false, error: "Name is required." };

  const role = text(formData, "role") as UserRole | "";

  try {
    if (role && ["OWNER", "TECH"].includes(role)) {
      await updateUserRole(userId, companyId, role as UserRole);
    }
    await updateUser(userId, companyId, { name });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update user. Please try again." };
  }
}

export async function deleteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const userId = text(formData, "userId");
  const companyId = text(formData, "companyId");

  if (!userId) return { ok: false, error: "User ID is required." };
  if (!companyId) return { ok: false, error: "Company ID is required." };

  try {
    await deleteUser(userId, companyId);
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete user. Please try again." };
  }
}
