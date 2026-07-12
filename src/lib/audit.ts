import "server-only"

import { prisma } from "@/lib/prisma"

async function log(
  companyId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action,
        details: details ? JSON.stringify(details) : null,
      },
    })
  } catch {
    // Silently fail — auditing should never crash the app
  }
}

export const audit = {
  log,

  async company(
    userId: string,
    companyId: string,
    action: string,
    details?: Record<string, unknown>,
  ) {
    await log(companyId, userId, `company.${action}`, details)
  },

  async user(
    userId: string,
    targetUserId: string,
    companyId: string,
    action: string,
    details?: Record<string, unknown>,
  ) {
    await log(companyId, userId, `user.${action}`, { targetUserId, ...details })
  },
}
