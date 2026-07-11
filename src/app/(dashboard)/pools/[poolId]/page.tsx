import { notFound, redirect } from "next/navigation"
import { Waves } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getPoolById } from "@/lib/db/pools"
import { getVisitHistory } from "@/lib/db/visits"
import { getWaterHealthScore } from "@/lib/pool-chemistry"
import type { WaterReading } from "@/generated/prisma/client"
import { Shell } from "@/components/ui/shell"
import { PoolAnalysis } from "@/components/pools/PoolAnalysis"

export default async function PoolAnalysisPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const { poolId } = await params

  const [pool, visits] = await Promise.all([
    getPoolById(poolId, user.companyId),
    getVisitHistory(poolId, 20),
  ])

  if (!pool) {
    notFound()
  }

  const scoredVisits = visits.map((visit) => {
    const reading = visit.waterReadings[0]
    const waterHealth = reading
      ? getWaterHealthScore({
          ph: reading.ph,
          freeChlorine: reading.freeChlorine,
          totalAlkalinity: reading.totalAlkalinity,
          calciumHardness: reading.calciumHardness,
          cyanuricAcid: reading.cyanuricAcid,
        })
      : null

    return {
      id: visit.id,
      date: visit.createdAt.toISOString(),
      scheduledAt: visit.scheduledAt?.toISOString() ?? null,
      tech: visit.tech ? { id: visit.tech.id, name: visit.tech.name } : null,
      waterHealth,
      readings: visit.waterReadings as WaterReading[],
      chemicals: visit.chemicalsAdded,
      notes: visit.notes,
    }
  })

  const scoreHistory = scoredVisits
    .filter((v): v is typeof v & { waterHealth: NonNullable<typeof v.waterHealth> } => v.waterHealth !== null)
    .map((v) => ({ date: v.date, score: v.waterHealth.score }))
    .reverse()

  const lastVisit = scoredVisits[0] ?? null
  const lastReadings = lastVisit?.readings[0] ?? null

  return (
    <Shell title={`${pool.name} — Analysis`} backHref="/pools" backLabel="Pools">
      <div className="space-y-6">
        {scoredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Waves className="size-8" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No completed visits yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete a service visit to see analysis and trends.
            </p>
          </div>
        ) : (
          <PoolAnalysis
            pool={{
              id: pool.id,
              name: pool.name,
              address: pool.address,
              volume: pool.volume,
              isActive: pool.isActive,
              homeownerEmail: pool.homeownerEmail,
              homeownerPhone: pool.homeownerPhone,
            }}
            scoredVisits={scoredVisits}
            scoreHistory={scoreHistory}
            lastReadings={
              lastReadings
                ? {
                    ph: lastReadings.ph,
                    freeChlorine: lastReadings.freeChlorine,
                    totalAlkalinity: lastReadings.totalAlkalinity,
                    calciumHardness: lastReadings.calciumHardness,
                    cyanuricAcid: lastReadings.cyanuricAcid,
                    temperature: lastReadings.temperature,
                  }
                : null
            }
          />
        )}
      </div>
    </Shell>
  )
}
