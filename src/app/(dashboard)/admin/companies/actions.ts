"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient, deleteAuthUserByEmail } from "@/lib/supabase/admin";
import { createCompany, deleteCompany, getCompanyById, updateCompany } from "@/lib/db/company";
import { createUser, deleteUser, updateUser, updateUserAdmin, updateUserRole } from "@/lib/db/users";
import type { UserRole } from "@/generated/prisma/client";
import { formText, formOptionalText } from "@/lib/utils";
import { logger } from "@/lib/log";
import { audit } from "@/lib/audit";

const text = formText;
const optionalText = formOptionalText;

export interface FormState {
  ok: boolean;
  error?: string;
}

export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const companyId = formText(formData, "companyId");
  if (!companyId) {
    return { ok: false, error: "Company ID is required." };
  }

  const name = formText(formData, "name");
  const email = formText(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  const subscriptionStatus = formOptionalText(formData, "subscriptionStatus");
  const active = formData.get("active") === "on";

  try {
    const prev = await getCompanyById(companyId);
    await updateCompany(companyId, {
      name,
      email,
      phone: formOptionalText(formData, "phone"),
      address: formOptionalText(formData, "address"),
      subscriptionStatus,
      active,
    });
    await audit.company(currentUser.id, companyId, "updated", { name, email, prevName: prev?.name });
    logger.info("Company updated", { context: "admin.companies.updateCompanyAction", companyId, userId: currentUser.id, metadata: { companyId, name, email } });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    logger.error("Failed to update company", { context: "admin.companies.updateCompanyAction", companyId, userId: currentUser.id, metadata: { companyId, name } });
    return { ok: false, error: "Could not update company. Please try again." };
  }
}

export async function createCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const name = formText(formData, "name");
  const email = formText(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  try {
    const created = await createCompany({
      name,
      email,
      phone: formOptionalText(formData, "phone"),
      address: formOptionalText(formData, "address"),
    });
    await audit.company(currentUser.id, created.id, "created", { name, email });
    logger.info("Company created", { context: "admin.companies.createCompanyAction", companyId: created.id, userId: currentUser.id, metadata: { name, email } });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    logger.error("Failed to create company", { context: "admin.companies.createCompanyAction", userId: currentUser.id, metadata: { name, email } });
    return { ok: false, error: "Could not create company. Please try again." };
  }
}

export async function deleteCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const companyId = formText(formData, "companyId");
  if (!companyId) {
    return { ok: false, error: "Company ID is required." };
  }

  const confirmName = formText(formData, "confirmName");

  const company = await getCompanyById(companyId);
  if (!company) {
    return { ok: false, error: "Company not found." };
  }

  if (confirmName !== company.name) {
    return { ok: false, error: "Company name does not match." };
  }

  try {
    await deleteCompany(companyId);
    await audit.company(currentUser.id, companyId, "deleted", { name: company.name });
    logger.info("Company deleted", { context: "admin.companies.deleteCompanyAction", companyId, userId: currentUser.id, metadata: { companyId, name: company.name } });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    logger.error("Failed to delete company", { context: "admin.companies.deleteCompanyAction", companyId, userId: currentUser.id, metadata: { companyId } });
    return { ok: false, error: "Could not delete company. Please try again." };
  }
}

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const companyId = formText(formData, "companyId");
  const name = formText(formData, "name");
  const email = formText(formData, "email");
  const role = formText(formData, "role") as UserRole;
  const password = formText(formData, "password");

  if (!companyId) return { ok: false, error: "Company ID is required." };
  if (name === "") return { ok: false, error: "Name is required." };
  if (email === "") return { ok: false, error: "Email is required." };
  if (!["OWNER", "TECH"].includes(role)) {
    return { ok: false, error: "Role must be OWNER or TECH." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with this email already exists." };
  }

  try {
    const admin = createAdminClient();
    let supabaseId: string | null = null;

    if (admin) {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
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
      supabaseId = authData.user.id;
    }

    const createdUser = await createUser({ name, email, role, companyId, supabaseId });
    await audit.user(currentUser.id, createdUser.id, companyId, "created", { name, email, role });
    logger.info("User created", { context: "admin.companies.createUserAction", companyId, userId: currentUser.id, metadata: { targetUserId: createdUser.id, name, email, role } });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    logger.error("Failed to create user", { context: "admin.companies.createUserAction", companyId, userId: currentUser.id, metadata: { name, email, role } });
    return { ok: false, error: "Could not create user. Please try again." };
  }
}

export async function updateUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const userId = formText(formData, "userId");
  const companyId = formText(formData, "companyId");
  const name = formText(formData, "name");

  if (!userId) return { ok: false, error: "User ID is required." };
  if (name === "") return { ok: false, error: "Name is required." };

  // SUPER_ADMIN cannot demote themselves
  if (userId === currentUser.id) {
    return { ok: false, error: "You cannot edit your own account." };
  }

  // Only a SUPER_ADMIN can modify another SUPER_ADMIN
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "SUPER_ADMIN") {
    return { ok: false, error: "Cannot modify another SUPER_ADMIN." };
  }

  const role = formText(formData, "role") as UserRole | "";
  const phone = formText(formData, "phone") || null;

  try {
    await updateUserAdmin(userId, companyId, {
      name,
      role: role && ["OWNER", "TECH"].includes(role) ? (role as UserRole) : undefined,
      phone,
    });
    await audit.user(currentUser.id, userId, companyId, "updated", { name, role, phone });
    logger.info("User updated", { context: "admin.companies.updateUserAction", companyId, userId: currentUser.id, metadata: { targetUserId: userId, name, role } });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    logger.error("Failed to update user", { context: "admin.companies.updateUserAction", companyId, userId: currentUser.id, metadata: { targetUserId: userId, name } });
    return { ok: false, error: "Could not update user. Please try again." };
  }
}

export async function deleteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const userId = formText(formData, "userId");
  const companyId = formText(formData, "companyId");

  if (!userId) return { ok: false, error: "User ID is required." };
  if (!companyId) return { ok: false, error: "Company ID is required." };

  // SUPER_ADMIN cannot delete themselves
  if (userId === currentUser.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  // Only a SUPER_ADMIN can delete another SUPER_ADMIN (already enforced by
  // requireSuperAdmin, but double-check the target isn't a SUPER_ADMIN we
  // shouldn't touch — actually another SUPER_ADMIN *can* delete a SUPER_ADMIN)
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };

  try {
    const deletedEmail = target.email;
    await deleteUser(userId, companyId);
    // Also remove the Supabase Auth identity so the email can be re-registered.
    await deleteAuthUserByEmail(deletedEmail);
    await audit.user(currentUser.id, userId, companyId, "deleted", { email: deletedEmail });
    logger.info("User deleted", { context: "admin.companies.deleteUserAction", companyId, userId: currentUser.id, metadata: { targetUserId: userId, email: deletedEmail } });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    logger.error("Failed to delete user", { context: "admin.companies.deleteUserAction", companyId, userId: currentUser.id, metadata: { targetUserId: userId } });
    return { ok: false, error: "Could not delete user. Please try again." };
  }
}
