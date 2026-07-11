"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createUser, deleteUser, updateUserAdmin } from "@/lib/db/users";
import type { UserRole } from "@/generated/prisma/client";

export interface FormState {
  ok: boolean;
  error?: string;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createTeamUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireOwner();
  if (!currentUser.companyId) {
    return { ok: false, error: "You must belong to a company to add users." };
  }

  const name = text(formData, "name");
  const email = text(formData, "email");
  const role = text(formData, "role") as UserRole;
  const password = text(formData, "password");
  const phone = text(formData, "phone") || null;

  if (name === "") return { ok: false, error: "Name is required." };
  if (email === "") return { ok: false, error: "Email is required." };
  if (!["OWNER", "TECH"].includes(role)) {
    return { ok: false, error: "Role must be OWNER or TECH." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  // Check Prisma for duplicate email first (covers edge cases where Supabase
  // Auth may not have the record but Prisma does).
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with this email already exists." };
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

    await createUser({ name, email, role, companyId: currentUser.companyId, phone });
    revalidatePath("/team");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create user. Please try again." };
  }
}

export async function updateTeamUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireOwner();
  if (!currentUser.companyId) {
    return { ok: false, error: "You must belong to a company to manage users." };
  }

  const userId = text(formData, "userId");
  const name = text(formData, "name");

  if (!userId) return { ok: false, error: "User ID is required." };
  if (name === "") return { ok: false, error: "Name is required." };

  // Cannot edit yourself
  if (userId === currentUser.id) {
    return { ok: false, error: "You cannot edit your own account." };
  }

  // Cannot edit SUPER_ADMIN
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "SUPER_ADMIN") {
    return { ok: false, error: "Cannot modify a platform administrator." };
  }

  // Cannot promote to SUPER_ADMIN
  const role = text(formData, "role") as UserRole | "";
  if (role === "SUPER_ADMIN") {
    return { ok: false, error: "Cannot promote a user to SUPER_ADMIN." };
  }

  const phone = text(formData, "phone") || null;

  try {
    await updateUserAdmin(userId, currentUser.companyId, {
      name,
      role: role && ["OWNER", "TECH"].includes(role) ? (role as UserRole) : undefined,
      phone,
    });
    revalidatePath("/team");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update user. Please try again." };
  }
}

export async function deleteTeamUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireOwner();
  if (!currentUser.companyId) {
    return { ok: false, error: "You must belong to a company to manage users." };
  }

  const userId = text(formData, "userId");
  if (!userId) return { ok: false, error: "User ID is required." };

  // Cannot delete yourself
  if (userId === currentUser.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  // Cannot delete SUPER_ADMIN
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "SUPER_ADMIN") {
    return { ok: false, error: "Cannot delete a platform administrator." };
  }

  try {
    await deleteUser(userId, currentUser.companyId);
    revalidatePath("/team");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete user. Please try again." };
  }
}
