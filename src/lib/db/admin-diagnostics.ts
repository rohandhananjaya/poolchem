import "server-only"

import * as os from "os"

import { prisma } from "@/lib/prisma"

export interface ServerInfo {
  hostname: string
  platform: string
  arch: string
  nodeVersion: string
  uptimeSeconds: number
  totalMemoryMb: number
  freeMemoryMb: number
  usedMemoryMb: number
  memoryUsagePercent: number
  cpuCount: number
  cpuLoadPercent: number
  processMemoryMb: number
  processUptimeSeconds: number
}

export interface DatabaseInfo {
  connected: boolean
  tableRowCounts: { table: string; count: number }[]
}

export interface LogSummary {
  total: number
  errors24h: number
  warnings24h: number
  info24h: number
  errors7d: number
  warnings7d: number
}

export interface SystemLogEntry {
  id: string
  level: string
  message: string
  context: string | null
  stack: string | null
  metadata: string | null
  createdAt: Date
}

export interface DiagnosticsData {
  server: ServerInfo
  database: DatabaseInfo
  logSummary: LogSummary
  recentLogs: SystemLogEntry[]
}

function getCpuLoad(): number {
  const cpus = os.cpus()
  if (cpus.length === 0) return 0

  let totalIdle = 0
  let totalTick = 0

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times]
    }
    totalIdle += cpu.times.idle
  }

  const idlePercent = (totalIdle / totalTick) * 100
  return Math.round((100 - idlePercent) * 100) / 100
}

function formatMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100
}

async function getDatabaseInfo(): Promise<DatabaseInfo> {
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    return { connected: false, tableRowCounts: [] }
  }

  const [companyCount, userCount, poolCount, visitCount, readingCount, chemCount, logCount] =
    await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.pool.count(),
      prisma.serviceVisit.count(),
      prisma.waterReading.count(),
      prisma.chemicalAdded.count(),
      prisma.systemLog.count(),
    ])

  return {
    connected: true,
    tableRowCounts: [
      { table: "companies", count: companyCount },
      { table: "users", count: userCount },
      { table: "pools", count: poolCount },
      { table: "service_visits", count: visitCount },
      { table: "water_readings", count: readingCount },
      { table: "chemicals_added", count: chemCount },
      { table: "system_logs", count: logCount },
    ],
  }
}

async function getLogSummary(): Promise<LogSummary> {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [total, errors24h, warnings24h, info24h, errors7d, warnings7d] = await Promise.all([
    prisma.systemLog.count(),
    prisma.systemLog.count({ where: { level: "ERROR", createdAt: { gte: dayAgo } } }),
    prisma.systemLog.count({ where: { level: "WARNING", createdAt: { gte: dayAgo } } }),
    prisma.systemLog.count({ where: { level: "INFO", createdAt: { gte: dayAgo } } }),
    prisma.systemLog.count({ where: { level: "ERROR", createdAt: { gte: weekAgo } } }),
    prisma.systemLog.count({ where: { level: "WARNING", createdAt: { gte: weekAgo } } }),
  ])

  return { total, errors24h, warnings24h, info24h, errors7d, warnings7d }
}

async function getRecentLogs(limit = 50): Promise<SystemLogEntry[]> {
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return logs.map((l) => ({
    id: l.id,
    level: l.level,
    message: l.message,
    context: l.context,
    stack: l.stack,
    metadata: l.metadata,
    createdAt: l.createdAt,
  }))
}

export async function getServerDiagnostics(): Promise<DiagnosticsData> {
  const server: ServerInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(os.uptime()),
    totalMemoryMb: formatMb(os.totalmem()),
    freeMemoryMb: formatMb(os.freemem()),
    usedMemoryMb: formatMb(os.totalmem() - os.freemem()),
    memoryUsagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    cpuCount: os.cpus().length,
    cpuLoadPercent: getCpuLoad(),
    processMemoryMb: formatMb(process.memoryUsage().rss),
    processUptimeSeconds: Math.floor(process.uptime()),
  }

  const [database, logSummary, recentLogs] = await Promise.all([
    getDatabaseInfo(),
    getLogSummary(),
    getRecentLogs(),
  ])

  return { server, database, logSummary, recentLogs }
}

/** Lightweight version for the dashboard overview (no full log list). */
export async function getServerHealthSummary(): Promise<{
  server: Pick<ServerInfo, "uptimeSeconds" | "processMemoryMb" | "cpuLoadPercent" | "platform">
  logSummary: LogSummary
}> {
  const server: ServerInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(os.uptime()),
    totalMemoryMb: formatMb(os.totalmem()),
    freeMemoryMb: formatMb(os.freemem()),
    usedMemoryMb: formatMb(os.totalmem() - os.freemem()),
    memoryUsagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    cpuCount: os.cpus().length,
    cpuLoadPercent: getCpuLoad(),
    processMemoryMb: formatMb(process.memoryUsage().rss),
    processUptimeSeconds: Math.floor(process.uptime()),
  }

  const logSummary = await getLogSummary()

  return {
    server: {
      uptimeSeconds: server.uptimeSeconds,
      processMemoryMb: server.processMemoryMb,
      cpuLoadPercent: server.cpuLoadPercent,
      platform: server.platform,
    },
    logSummary,
  }
}
