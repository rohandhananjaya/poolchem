import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Droplets,
  Minus,
  Quote,
} from "lucide-react"

import { requireTech } from "@/lib/auth"
import {
  generateServiceReport,
  type ParameterStatus,
  type ReportParameter,
} from "@/lib/reports/generate-report"
import { cn } from "@/lib/utils"
import { WaterHealthGauge } from "@/components/visits/WaterHealthGauge"
import { ScoreSparkline } from "@/components/reports/ScoreSparkline"
import { ReportActions } from "./report-actions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ visitId: string }>
}) {
  const { visitId } = await params
  const user = await requireTech().catch(() => null)
  if (!user?.companyId) return { title: "Service Report" }
  const report = await generateServiceReport(visitId, user.companyId)
  if (!report) return { title: "Service Report" }
  return {
    title: `Service Report — ${report.pool.name} — ${format(new Date(report.visit.date), "MMM d, yyyy")}`,
  }
}

/** Returns the first character(s) usable as a logo fallback. */
function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const STATUS_META: Record<
  ParameterStatus,
  { label: string; className: string }
> = {
  ideal: {
    label: "Ideal",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  low: { label: "Low", className: "text-amber-600 dark:text-amber-400" },
  high: { label: "High", className: "text-amber-600 dark:text-amber-400" },
  info: { label: "—", className: "text-muted-foreground" },
}

function StatusIcon({ status }: { status: ParameterStatus }) {
  if (status === "ideal")
    return <CheckCircle2 className="size-4 text-emerald-500" />
  if (status === "info") return <Minus className="size-4 text-muted-foreground" />
  return <AlertTriangle className="size-4 text-amber-500" />
}

function TestRow({ param }: { param: ReportParameter }) {
  const meta = STATUS_META[param.status]
  const unit = param.unit ? ` ${param.unit}` : ""
  return (
    <tr className="border-t border-border">
      <td className="py-2.5 pr-3 text-sm font-medium text-foreground">
        {param.label}
      </td>
      <td className="py-2.5 pr-3 text-sm tabular-nums text-foreground">
        {param.value}
        {unit}
      </td>
      <td className="py-2.5 pr-3 text-sm tabular-nums text-muted-foreground">
        {param.ideal ? `${param.ideal.min}–${param.ideal.max}${unit}` : "—"}
      </td>
      <td className="py-2.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium",
            meta.className,
          )}
        >
          <StatusIcon status={param.status} />
          {meta.label}
        </span>
      </td>
    </tr>
  )
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { visitId } = await params
  const user = await requireTech().catch(() => null)
  if (!user?.companyId) return null

  const report = await generateServiceReport(visitId, user.companyId)
  if (!report) notFound()

  const visitDate = new Date(report.visit.date)
  const nextServiceDate = new Date(report.nextServiceDate)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
    report.homeownerUrl,
  )}`

  const { from } = await searchParams

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8 print:max-w-none print:px-0 print:py-0">
      {/* Screen-only toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={from ?? `/visits/${visitId}`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
          aria-label={from ? "Back" : "Back to visit"}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <ReportActions
          homeownerEmail={report.company.email}
          poolName={report.pool.name}
        />
      </div>

      {/* The printable report sheet */}
      <article className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Company header */}
        <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            {report.company.logo ? (
              <Image
                src={report.company.logo}
                alt={report.company.name}
                width={48}
                height={48}
                className="size-12 rounded-xl object-cover"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-xl bg-teal-600 text-base font-semibold text-white">
                {initials(report.company.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {report.company.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[report.company.phone, report.company.email]
                  .filter(Boolean)
                  .join(" · ") || "Professional pool service"}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 text-teal-600 sm:flex print:flex">
            <Droplets className="size-5" />
            <span className="text-sm font-semibold">PoolChem</span>
          </div>
        </header>

        {/* Title */}
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Service Report
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {report.pool.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(visitDate, "EEEE, MMMM d, yyyy")}
            {report.pool.address ? ` · ${report.pool.address}` : ""}
            {" · "}
            {report.pool.volume.toLocaleString()} gal · Serviced by{" "}
            {report.tech.name}
          </p>
        </div>

        {/* Water health score */}
        <section className="mt-6 flex flex-col items-center gap-5 rounded-xl bg-muted/40 p-5 sm:flex-row sm:justify-around print:bg-transparent">
          {report.waterHealth ? (
            <>
              <WaterHealthGauge
                score={report.waterHealth.score}
                status={report.waterHealth.status}
                lsi={report.lsi}
              />
              <div className="min-w-0 flex-1 space-y-2 sm:max-w-xs">
                {report.waterHealth.issues.length === 0 ? (
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    All parameters are within their ideal range — your water is
                    in great shape.
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {report.waterHealth.issues.length} item
                      {report.waterHealth.issues.length > 1 ? "s" : ""} to keep an
                      eye on:
                    </p>
                    <ul className="space-y-1">
                      {report.waterHealth.issues.map((issue, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground"
                        >
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No water readings were recorded for this visit.
            </p>
          )}
        </section>

        {/* What we tested */}
        {report.parameters.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">
              What We Tested
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-1 pr-3 font-medium">Parameter</th>
                    <th className="pb-1 pr-3 font-medium">Reading</th>
                    <th className="pb-1 pr-3 font-medium">Ideal Range</th>
                    <th className="pb-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.parameters.map((param) => (
                    <TestRow key={param.key} param={param} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Chemicals added */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">
            Chemicals Added
          </h2>
          {report.chemicalsAdded.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No chemicals were needed — your water was well balanced.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {report.chemicalsAdded.map((chem, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    {chem.name}
                  </span>
                  {chem.amount > 0 && (
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {chem.amount} {chem.unit}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Technician notes */}
        {report.visit.notes?.trim() && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">
              Notes From Your Technician
            </h2>
            <blockquote className="mt-2 flex gap-3 rounded-lg border-l-4 border-teal-500 bg-muted/40 p-4 print:bg-transparent">
              <Quote className="size-4 shrink-0 text-teal-500" />
              <p className="text-sm italic text-foreground">
                {report.visit.notes}
              </p>
            </blockquote>
          </section>
        )}

        {/* Trend */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">
            Water Health Trend
          </h2>
          <p className="text-xs text-muted-foreground">
            Score across the last {report.scoreHistory.length || "few"} visits
          </p>
          <div className="mt-2">
            <ScoreSparkline points={report.scoreHistory} />
          </div>
        </section>

        {/* Footer: next service + QR */}
        <footer className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 text-teal-600" />
            <span className="text-muted-foreground">Next service:</span>
            <span className="font-semibold text-foreground">
              {format(nextServiceDate, "EEEE, MMMM d, yyyy")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">
                View your pool anytime
              </p>
              <p className="text-xs text-muted-foreground">
                Scan for your homeowner dashboard
              </p>
            </div>
            {/* External QR service — MVP placeholder for the homeowner dashboard link. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="QR code to your homeowner dashboard"
              width={72}
              height={72}
              className="size-[72px] rounded-lg border border-border bg-white p-1"
            />
          </div>
        </footer>
      </article>
    </div>
  )
}
