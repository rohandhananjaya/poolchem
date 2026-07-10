import "server-only"

import * as os from "os"

export interface LiveServerStats {
  cpuLoadPercent: number
  totalMemoryMb: number
  freeMemoryMb: number
  usedMemoryMb: number
  usedMemoryPercent: number
  processMemoryMb: number
  uptimeSeconds: number
  timestamp: number
}

function formatMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100
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

export function getLiveServerStats(): LiveServerStats {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  return {
    cpuLoadPercent: getCpuLoad(),
    totalMemoryMb: formatMb(totalMem),
    freeMemoryMb: formatMb(freeMem),
    usedMemoryMb: formatMb(usedMem),
    usedMemoryPercent: Math.round((usedMem / totalMem) * 100),
    processMemoryMb: formatMb(process.memoryUsage().rss),
    uptimeSeconds: Math.floor(os.uptime()),
    timestamp: Date.now(),
  }
}
