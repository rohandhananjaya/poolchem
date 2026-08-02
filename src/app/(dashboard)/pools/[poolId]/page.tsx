import { notFound, redirect } from "next/navigation"
import { Waves } from "lucide-react"

import { EmptyState } from "@/components/ui/empty-state"
import { requireTech } from "@/lib/auth"
import { getPoolById } from "@/lib/db/pools"
import { getVisitHistory } from "@/lib/db/visits"
import { getWaterHealthScore } from "@/lib/pool-chemistry"
import { buildScanUrl } from "@/lib/scan-code"
import { generateQRDataUrl } from "@/lib/reports/qr"
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

  const scanUrl = buildScanUrl(pool.qrCode)
  const qrSrc = await generateQRDataUrl(scanUrl)

  return (
    <Shell title={`${pool.name} — Analysis`} backHref="/pools" backLabel="Pools">
      <div className="space-y-6">
        {scoredVisits.length === 0 ? (
          <EmptyState
            icon={<Waves className="size-8" />}
            title="No completed visits yet."
            description="Complete a service visit to see analysis and trends."
          />
        ) : (
          <PoolAnalysis
            pool={{
              id: pool.id,
              publicToken: pool.publicToken,
              name: pool.name,
              address: pool.address,
              volume: pool.volume,
              isActive: pool.isActive,
              homeownerEmail: pool.homeownerEmail,
              homeownerPhone: pool.homeownerPhone,
            }}
            scoredVisits={scoredVisits}
            scoreHistory={scoreHistory}
            scanUrl={scanUrl}
            qrSrc={qrSrc}
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
