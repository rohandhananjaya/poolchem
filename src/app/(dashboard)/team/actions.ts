"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createAdminClient, deleteAuthUserByEmail } from "@/lib/supabase/admin";
import { createUser, deleteUser, updateUserAdmin } from "@/lib/db/users";
import { createInvitation } from "@/lib/db/invitations";
import type { UserRole } from "@/generated/prisma/client";
import { formText } from "@/lib/utils";

const text = formText;

export interface FormState {
  ok: boolean;
  error?: string;
  inviteUrl?: string;
}

export async function createTeamUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireOwner();
  if (!currentUser.companyId) {
    return { ok: false, error: "You must belong to a company to add users." };
  }

  const name = formText(formData, "name");
  const email = formText(formData, "email");
  const role = formText(formData, "role") as UserRole;
  const password = formText(formData, "password");
  const phone = formText(formData, "phone") || null;

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
    const admin = createAdminClient();

    if (admin) {
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

  const userId = formText(formData, "userId");
  const name = formText(formData, "name");

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
  const role = formText(formData, "role") as UserRole | "";
  if (role === "SUPER_ADMIN") {
    return { ok: false, error: "Cannot promote a user to SUPER_ADMIN." };
  }

  const phone = formText(formData, "phone") || null;

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

  const userId = formText(formData, "userId");
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
    // Also remove the Supabase Auth identity so the email can be re-registered.
    await deleteAuthUserByEmail(target.email);
    revalidatePath("/team");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete user. Please try again." };
  }
}

export async function inviteTeamUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireOwner();
  if (!currentUser.companyId) {
    return { ok: false, error: "You must belong to a company to invite users." };
  }

  const name = formText(formData, "name");
  const email = formText(formData, "email");
  const role = formText(formData, "role") as UserRole;

  if (name === "") return { ok: false, error: "Name is required." };
  if (email === "") return { ok: false, error: "Email is required." };
  if (!["OWNER", "TECH"].includes(role)) {
    return { ok: false, error: "Role must be OWNER or TECH." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with this email already exists." };
  }

  try {
    const invitation = await createInvitation({
      name,
      email,
      role,
      companyId: currentUser.companyId,
    });

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const inviteUrl = `${origin}/invite/${invitation.token}`;

    revalidatePath("/team");
    return { ok: true, inviteUrl };
  } catch {
    return { ok: false, error: "Could not create invitation. Please try again." };
  }
}
