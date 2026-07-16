"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { getCompanyById, getCompanyFromEmail } from "@/lib/db/company";
import { sendEmail } from "@/lib/email";
import { buildInvitationEmail } from "@/lib/email/templates";
import { logger } from "@/lib/log";

export interface InvitationState {
  ok: boolean;
  error?: string;
}

/**
 * Creates an invitation record and sends the invitation email.
 */
export async function sendInvitationAction(
  _prev: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  try {
    const currentUser = await requireSuperAdmin();

    const companyId = formData.get("companyId") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;

    if (!companyId) return { ok: false, error: "Company ID is required." };
    if (!name?.trim()) return { ok: false, error: "Name is required." };
    if (!email?.trim()) return { ok: false, error: "Email is required." };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "A user with this email already exists." };
    }

    const company = await getCompanyById(companyId);
    if (!company) return { ok: false, error: "Company not found." };

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        email: email.trim(),
        name: name.trim(),
        role: "TECH",
        companyId,
        expiresAt,
      },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${origin}/invite/${invitation.token}`;
    const from = getCompanyFromEmail(company);

    const emailPayload = buildInvitationEmail({
      to: email.trim(),
      from,
      companyName: company.name,
      inviteUrl,
    });

    const result = await sendEmail(emailPayload);
    if (!result.ok) {
      logger.error("Failed to send invitation email", {
        context: "admin.companies.sendInvitationAction",
        companyId,
        userId: currentUser.id,
        metadata: { name, email, error: result.error },
      });
      return { ok: false, error: result.error ?? "Failed to send email." };
    }

    logger.info("Invitation sent", {
      context: "admin.companies.sendInvitationAction",
      companyId,
      userId: currentUser.id,
      metadata: { invitationId: invitation.id, name, email },
    });

    revalidatePath(`/admin/companies/${companyId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("sendInvitationAction threw", {
      context: "admin.companies.sendInvitationAction",
      metadata: { error: message },
    });
    return { ok: false, error: message };
  }
}
