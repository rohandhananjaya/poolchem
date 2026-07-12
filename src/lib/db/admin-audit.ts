import "server-only"

import { prisma } from "@/lib/prisma"

export interface AuditLogEntry {
  id: string
  companyId: string
  userId: string
  action: string
  details: string | null
  createdAt: Date
}

export interface AuditLogWithUser extends AuditLogEntry {
  userName: string | null
}

export async function getCompanyAuditLogs(
  companyId: string,
  limit = 50,
): Promise<AuditLogWithUser[]> {
  const logs = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { company: false },
  })

  const userIds = [...new Set(logs.map((l) => l.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  return logs.map((l) => ({
    id: l.id,
    companyId: l.companyId,
    userId: l.userId,
    action: l.action,
    details: l.details,
    createdAt: l.createdAt,
    userName: userMap.get(l.userId) ?? null,
  }))
}

export async function getAllAuditLogs(limit = 50): Promise<AuditLogWithUser[]> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const userIds = [...new Set(logs.map((l) => l.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  return logs.map((l) => ({
    id: l.id,
    companyId: l.companyId,
    userId: l.userId,
    action: l.action,
    details: l.details,
    createdAt: l.createdAt,
    userName: userMap.get(l.userId) ?? null,
  }))
}

export interface AuditSummary {
  total: number
  byAction: { action: string; count: number }[]
}

export async function getAuditSummary(companyId?: string): Promise<AuditSummary> {
  const where = companyId ? { companyId } : {}

  const [total, grouped] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
      orderBy: { _count: { action: "desc" } },
    }),
  ])

  return {
    total,
    byAction: grouped.map((g) => ({ action: g.action, count: g._count })),
  }
}
