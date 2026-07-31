"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { getCompanyById, getCompanyFromEmail } from "@/lib/db/company";
import { getVisitById } from "@/lib/db/visits";
import { sendEmail } from "@/lib/email";
import { buildReportShareEmail } from "@/lib/email/templates";
import { logger } from "@/lib/log";

export interface SendReportEmailState {
  ok: boolean;
  error?: string;
}

/**
 * Server action that sends a service report link via email.
 *
 * The caller (tech) provides the recipient address; the report link is resolved
 * server-side so no user-facing URL construction happens on the client.
 */
export async function sendReportEmailAction(
  visitId: string,
  recipientEmail: string,
): Promise<SendReportEmailState> {
  try {
    const user = await requireTech();
    if (!user.companyId) return { ok: false, error: "No company affiliation." };

    const company = await getCompanyById(user.companyId);
    if (!company) return { ok: false, error: "Company not found." };

    const visit = await getVisitById(visitId, user.companyId);
    if (!visit) return { ok: false, error: "Visit not found." };

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
    const reportUrl = visit.publicToken
      ? `${origin}/report/${visit.publicToken}`
      : `${origin}/visits/${visitId}/report`;

    const from = getCompanyFromEmail(company);

    const email = buildReportShareEmail({
      to: recipientEmail,
      from,
      companyName: company.name,
      poolName: visit.pool.name,
      reportUrl,
    });

    const result = await sendEmail(email);
    if (!result.ok) {
      logger.error("Failed to send report email", {
        context: "report.sendReportEmailAction",
        companyId: user.companyId,
        userId: user.id,
        metadata: { visitId, recipientEmail, error: result.error },
      });
      return { ok: false, error: result.error ?? "Failed to send email." };
    }

    revalidatePath(`/visits/${visitId}/report`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("sendReportEmailAction threw", {
      context: "report.sendReportEmailAction",
      metadata: { visitId, recipientEmail, error: message },
    });
    return { ok: false, error: message };
  }
}
