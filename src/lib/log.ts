import "server-only"

import { prisma } from "@/lib/prisma"

type LogLevel = "ERROR" | "WARNING" | "INFO"

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  stack?: string
  metadata?: Record<string, unknown>
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
      },
    })
  } catch {
    // Silently fail — logging should never crash the app
  }
}

export const logger = {
  error(message: string, context?: string, meta?: Record<string, unknown>) {
    log({ level: "ERROR", message, context, stack: new Error().stack, metadata: meta })
  },

  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    log({ level: "WARNING", message, context, metadata: meta })
  },

  info(message: string, context?: string, meta?: Record<string, unknown>) {
    log({ level: "INFO", message, context, metadata: meta })
  },
}
