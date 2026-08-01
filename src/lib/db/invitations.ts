/**
 * Data access for {@link Invitation} records — pending invites for technicians
 * to join a company by setting their own password.
 */
import "server-only"

import type { UserRole } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

/** Fields required to create an invitation. */
export interface CreateInvitationData {
  email: string
  name: string
  role: UserRole
  companyId: string
}

/** Creates a new invitation with a 7-day expiry. */
export async function createInvitation(data: CreateInvitationData) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return prisma.invitation.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      companyId: data.companyId,
      expiresAt,
    },
  })
}

/** Returns a pending invitation by token, or null if not found/expired/accepted. */
export async function getValidInvitation(token: string) {
  return prisma.invitation.findFirst({
    where: {
      token,
      accepted: false,
      expiresAt: { gte: new Date() },
    },
    include: { company: true },
  })
}

/** Marks an invitation as accepted. */
export async function acceptInvitation(token: string) {
  return prisma.invitation.update({
    where: { token },
    data: { accepted: true },
  })
}

/** Returns all pending invitations for a company. */
export async function getInvitationsByCompany(companyId: string) {
  return prisma.invitation.findMany({
    where: { companyId, accepted: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  })
}

/** Counts pending TECH invitations for a company — used to enforce a plan's `max_techs`. */
export async function getPendingTechInvitationCount(companyId: string): Promise<number> {
  return prisma.invitation.count({
    where: { companyId, role: "TECH", accepted: false, expiresAt: { gte: new Date() } },
  })
}

/** Deletes an invitation by id (scoped to company). */
export async function deleteInvitation(id: string, companyId: string) {
  const { count } = await prisma.invitation.deleteMany({
    where: { id, companyId },
  })
  if (count === 0) {
    throw new Error(`Invitation "${id}" not found.`)
  }
}
