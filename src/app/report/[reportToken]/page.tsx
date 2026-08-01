import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Droplets,
  MapPin,
  Minus,
  Quote,
  User,
} from "lucide-react"

import { generateQRDataUrl } from "@/lib/reports/qr"
import { getPublicReport } from "@/lib/reports/public-report"
import type {
  ParameterStatus,
  ReportParameter,
} from "@/lib/reports/generate-report"
import { cn } from "@/lib/utils"
import { WaterHealthSummary } from "@/components/reports/WaterHealthSummary"
import { ScoreSparkline } from "@/components/reports/ScoreSparkline"
import { CompanyLogo } from "@/components/shared/CompanyLogo"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reportToken: string }>
}) {
  const { reportToken } = await params
  const report = await getPublicReport(reportToken)
  if (!report) return { title: "Service Report | Poolbench" }
  return {
    title: `Service Report — ${report.pool.name} — ${format(new Date(report.visit.date), "MMM d, yyyy")} | Poolbench`,
    description: `Pool service report for ${report.pool.name}, serviced by ${report.company.name}.`,
    openGraph: {
      title: `Service Report — ${report.pool.name} — ${format(new Date(report.visit.date), "MMM d, yyyy")} | Poolbench`,
      description: `Pool service report for ${report.pool.name}, serviced by ${report.company.name}.`,
      url: `/report/${reportToken}`,
    },
    alternates: { canonical: `/report/${reportToken}` },
    robots: { index: false, follow: false },
  }
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
  info: { label: "\u2014", className: "text-muted-foreground" },
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
        {param.ideal ? `${param.ideal.min}\u2013${param.ideal.max}${unit}` : "\u2014"}
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

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ reportToken: string }>
}) {
  const { reportToken } = await params
  const report = await getPublicReport(reportToken)
  if (!report) notFound()

  const visitDate = new Date(report.visit.date)
  const nextServiceDate = report.nextServiceDate ? new Date(report.nextServiceDate) : null
  const qrSrc = await generateQRDataUrl(report.homeownerUrl)

  return (
    <div className="printable-report mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8 print:max-w-none print:p-10">
      <article className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Company header */}
        <header className="flex items-center justify-between gap-4 border-b border-border pb-5 print:break-inside-avoid print:break-after-avoid">
          <div className="flex items-center gap-3">
            {report.company.logo && (
              <CompanyLogo
                src={report.company.logo}
                alt={report.company.name}
                size={48}
                className="shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {report.company.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[report.company.phone, report.company.address]
                  .filter(Boolean)
                  .join(" \u00b7 ") || "Professional pool service"}
              </p>
            </div>
          </div>
        </header>

        {/* Title */}
        <div className="mt-5 print:mt-0 print:pt-5 print:break-inside-avoid">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Service Report
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {report.pool.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <CalendarClock className="size-4 shrink-0 text-brand-600" />
              {format(visitDate, "EEEE, MMMM d, yyyy")}
            </span>
            {report.pool.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 shrink-0 text-brand-600" />
                {report.pool.address}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Droplets className="size-4 shrink-0 text-brand-600" />
              {report.pool.volume.toLocaleString()} gal
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <User className="size-4 shrink-0 text-brand-600" />
              {report.tech.name}
            </span>
          </div>
        </div>

        {/* Water health score */}
        <WaterHealthSummary waterHealth={report.waterHealth} lsi={report.lsi} />

        {/* What we tested */}
        {report.parameters.length > 0 && (
          <section className="mt-6 print:mt-0 print:pt-10">
            <h2 className="text-sm font-semibold text-foreground print:break-after-avoid">
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
        <section className="mt-6 print:mt-0 print:pt-10">
          <h2 className="text-sm font-semibold text-foreground print:break-after-avoid">
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
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 print:break-inside-avoid"
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
          <section className="mt-6 print:mt-0 print:pt-10">
            <h2 className="text-sm font-semibold text-foreground print:break-after-avoid">
              Notes From Your Technician
            </h2>
            <blockquote className="mt-2 flex gap-3 rounded-lg border-l-4 border-brand-500 bg-muted/40 p-4 print:break-inside-avoid print:bg-transparent">
              <Quote className="size-4 shrink-0 text-brand-500" />
              <p className="text-sm italic text-foreground">
                {report.visit.notes}
              </p>
            </blockquote>
          </section>
        )}

        {/* Trend */}
        <section className="mt-6 print:mt-0 print:pt-10 print:break-inside-avoid">
          <h2 className="text-sm font-semibold text-foreground print:break-after-avoid">
            Water Health Trend
          </h2>
          <p className="text-xs text-muted-foreground">
            Score across the last {report.scoreHistory.length || "few"} visits
          </p>
          <div className="mt-2">
            <ScoreSparkline points={report.scoreHistory} />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center print:mt-0 print:pt-12 print:break-inside-avoid">
          {nextServiceDate && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                <CalendarClock className="size-4 shrink-0 text-brand-600" />
                Next service:
              </span>
              <span className="whitespace-nowrap font-semibold text-foreground">
                {format(nextServiceDate, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 self-end sm:self-auto sm:ml-auto">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">
                View your pool anytime
              </p>
              <p className="text-xs text-muted-foreground">
                Scan for your homeowner dashboard
              </p>
            </div>
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

      {/* Footer branding */}
      <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Droplets className="size-3 text-brand-500" />
        Powered by Poolbench
      </footer>
    </div>
  )
}
