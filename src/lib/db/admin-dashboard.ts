import "server-only"

import { format, subDays } from "date-fns"

import { prisma } from "@/lib/prisma"
import { ServiceVisitStatus } from "@/generated/prisma/client"

export interface RegistrationTrendItem {
  date: string
  users: number
  companies: number
}

export interface VisitTrendItem {
  date: string
  completed: number
}

export interface RecentUser {
  id: string
  name: string
  email: string
  role: string
  companyName: string | null
  createdAt: Date
}

export interface SubscriptionBreakdownItem {
  status: string
  count: number
}

export interface AdminDashboardData {
  totalCompanies: number
  totalUsers: number
  totalActivePools: number
  totalCompletedVisits: number
  todayCompletedVisits: number
  todayNewUsers: number
  todayNewCompanies: number

  registrationTrend: RegistrationTrendItem[]
  visitTrend: VisitTrendItem[]

  recentUsers: RecentUser[]
  subscriptionBreakdown: SubscriptionBreakdownItem[]
}

function todayRange(): { gte: Date; lt: Date } {
  const now = new Date()
  const gte = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lt = new Date(gte)
  lt.setDate(lt.getDate() + 1)
  return { gte, lt }
}

function daysAgoRange(days: number): { gte: Date; lt: Date } {
  const now = new Date()
  const lt = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  lt.setDate(lt.getDate() + 1)
  const gte = subDays(lt, days)
  return { gte, lt }
}

function formatDateKey(date: Date): string {
  return format(date, "MMM d")
}

function buildDateMap(days: number): Map<string, number> {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  end.setDate(end.getDate() + 1)
  const start = subDays(end, days)

  const map = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    map.set(formatDateKey(d), 0)
  }
  return map
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const { gte: todayStart, lt: todayEnd } = todayRange()
  const { gte: trendStart } = daysAgoRange(14)
  const trendEnd = todayEnd

  const [
    totalCompanies,
    totalUsers,
    totalActivePools,
    totalCompletedVisits,
    todayCompletedVisits,
    todayNewUsers,
    todayNewCompanies,
    recentUsers,
    subscriptionBreakdown,
    allUsersInTrend,
    allCompaniesInTrend,
    allVisitsInTrend,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.pool.count({ where: { isActive: true } }),
    prisma.serviceVisit.count({ where: { status: ServiceVisitStatus.COMPLETED } }),
    prisma.serviceVisit.count({
      where: { status: ServiceVisitStatus.COMPLETED, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.user.count({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.company.count({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.user.findMany({
      where: {},
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { company: { select: { name: true } } },
    }),
    prisma.company.groupBy({
      by: ["subscriptionStatus"],
      _count: true,
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: trendStart, lt: trendEnd } },
      select: { createdAt: true },
    }),
    prisma.company.findMany({
      where: { createdAt: { gte: trendStart, lt: trendEnd } },
      select: { createdAt: true },
    }),
    prisma.serviceVisit.findMany({
      where: { status: ServiceVisitStatus.COMPLETED, createdAt: { gte: trendStart, lt: trendEnd } },
      select: { createdAt: true },
    }),
  ])

  const usersByDate = buildDateMap(14)
  const companiesByDate = buildDateMap(14)
  const visitsByDate = buildDateMap(14)

  for (const u of allUsersInTrend) {
    const key = formatDateKey(u.createdAt)
    usersByDate.set(key, (usersByDate.get(key) ?? 0) + 1)
  }
  for (const c of allCompaniesInTrend) {
    const key = formatDateKey(c.createdAt)
    companiesByDate.set(key, (companiesByDate.get(key) ?? 0) + 1)
  }
  for (const v of allVisitsInTrend) {
    const key = formatDateKey(v.createdAt)
    visitsByDate.set(key, (visitsByDate.get(key) ?? 0) + 1)
  }

  const registrationTrend: RegistrationTrendItem[] = Array.from(usersByDate.entries()).map(
    ([date, users]) => ({
      date,
      users,
      companies: companiesByDate.get(date) ?? 0,
    }),
  )

  const visitTrend: VisitTrendItem[] = Array.from(visitsByDate.entries()).map(
    ([date, completed]) => ({ date, completed }),
  )

  return {
    totalCompanies,
    totalUsers,
    totalActivePools,
    totalCompletedVisits,
    todayCompletedVisits,
    todayNewUsers,
    todayNewCompanies,
    registrationTrend,
    visitTrend,
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyName: u.company?.name ?? null,
      createdAt: u.createdAt,
    })),
    subscriptionBreakdown: subscriptionBreakdown.map((s) => ({
      status: s.subscriptionStatus ?? "none",
      count: s._count,
    })),
  }
}
