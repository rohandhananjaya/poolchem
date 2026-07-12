import "server-only"

import { prisma } from "@/lib/prisma"

type LogLevel = "ERROR" | "WARNING" | "INFO"

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  stack?: string
  metadata?: Record<string, unknown>
  companyId?: string
  userId?: string
}

function serializeMeta(meta?: Record<string, unknown>): string | undefined {
  if (!meta) return undefined
  try {
    return JSON.stringify(meta)
  } catch {
    return undefined
  }
}

async function log(entry: LogEntry): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        level: entry.level,
        message: entry.message,
        context: entry.context ?? null,
        stack: entry.stack ?? null,
        metadata: serializeMeta(entry.metadata),
        companyId: entry.companyId ?? null,
        userId: entry.userId ?? null,
      },
    })
  } catch {
    // Silently fail — logging should never crash the app
  }
}

export const logger = {
  error(
    message: string,
    opts?: { context?: string; metadata?: Record<string, unknown>; companyId?: string; userId?: string },
  ) {
    log({
      level: "ERROR",
      message,
      context: opts?.context,
      stack: new Error().stack,
      metadata: opts?.metadata,
      companyId: opts?.companyId,
      userId: opts?.userId,
    })
  },

  warn(
    message: string,
    opts?: { context?: string; metadata?: Record<string, unknown>; companyId?: string; userId?: string },
  ) {
    log({
      level: "WARNING",
      message,
      context: opts?.context,
      metadata: opts?.metadata,
      companyId: opts?.companyId,
      userId: opts?.userId,
    })
  },

  info(
    message: string,
    opts?: { context?: string; metadata?: Record<string, unknown>; companyId?: string; userId?: string },
  ) {
    log({
      level: "INFO",
      message,
      context: opts?.context,
      metadata: opts?.metadata,
      companyId: opts?.companyId,
      userId: opts?.userId,
    })
  },
}
