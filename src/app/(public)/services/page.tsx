import type { Metadata } from "next"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Beaker,
  CalendarClock,
  Check,
  FileText,
  QrCode,
  ShieldCheck,
  Waves,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Pool Service Software Features | Poolbench",
  description:
    "Discover how Poolbench helps pool-service companies streamline water testing, chemical dosing, visit scheduling, and report generation.",
  openGraph: {
    title: "Pool Service Software Features | Poolbench",
    description:
      "Discover how Poolbench helps pool-service companies streamline water testing, chemical dosing, visit scheduling, and report generation.",
    url: "/services",
  },
  alternates: { canonical: "/services" },
}

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const services = [
  {
    icon: Activity,
    title: "Water Health Scoring",
    shortDesc:
      "Every reading is scored 0–100 with a Langelier Saturation Index verdict, so techs know at a glance whether the water is balanced, corrosive, or scaling.",
    details: [
      "Poolbench's algorithm analyzes test strip readings against ideal ranges for pH, total alkalinity, calcium hardness, cyanuric acid, and temperature.",
      "Each parameter is scored individually, then combined into a single 0–100 health score with an LSI verdict — balanced, corrosive, or scaling.",
      "Techs can view the score trend over time, making it easy to spot developing problems before they become expensive repairs.",
    ],
  },
  {
    icon: Beaker,
    title: "Chemical Dose Recommendations",
    shortDesc:
      "Enter the test readings and pool volume; Poolbench returns the exact chemical doses needed to bring the water back into range.",
    details: [
      "No more mental math or reference charts. Poolbench calculates precise amounts of each chemical — acid, chlorine, alkalinity increaser, calcium chloride, and more.",
      "Doses are returned in the units on the label (ounces, pounds, gallons, or liters), so techs can measure and add without conversion errors.",
      "The engine accounts for pool volume, current readings, target ranges, and chemical concentration for accurate, repeatable recommendations every time.",
    ],
  },
  {
    icon: FileText,
    title: "Shareable Service Reports",
    shortDesc:
      "Each visit generates a clean report you can hand to the homeowner. They get a public link — no login, no app to install.",
    details: [
      "After every visit, Poolbench generates a professional service report that includes before/after readings, health score, chemical doses added, and technician notes.",
      "Homeowners receive a unique public link — no app download, no account creation. Just open and view the report in any browser.",
      "Reports are branded with your company name and can be sent via email, text, or printed on site. Every report is stored permanently for future reference.",
    ],
  },
  {
    icon: QrCode,
    title: "QR Code Visit Start",
    shortDesc:
      "Tag each pool with a unique QR code. Techs scan on arrival to open the right visit form instantly, with the pool's history already loaded.",
    details: [
      "Each pool in your system gets a unique QR code sticker. Print them from the dashboard and affix to the equipment pad or poolside.",
      "When a tech arrives, they scan the QR code with their phone camera. Poolbench instantly loads the pool's history, last readings, and a fresh visit form.",
      "Eliminates misidentified pools, lost paper tickets, and time spent searching for customer records. The visit starts in seconds.",
    ],
  },
  {
    icon: CalendarClock,
    title: "Scheduling & History",
    shortDesc:
      "See upcoming visits, track water-health trends over time, and never lose the record of what was dosed and when.",
    details: [
      "The schedule view shows all upcoming visits across your company in a clean timeline — assign techs, set recurring routes, and manage daily workload from one screen.",
      "Every completed visit adds to the pool's permanent history: reading data, health scores, chemicals added, and technician notes. Build a complete water-quality record.",
      "Trend charts show how health scores, pH, chlorine, and other parameters evolve week over week, helping you identify chronic issues and demonstrate value to customers.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Built for Teams",
    shortDesc:
      "Multi-company by design. Every pool, visit, and reading is scoped to your company — your data never mixes with anyone else's.",
    details: [
      "Poolbench is a multi-tenant platform from the ground up. Each company operates in its own isolated workspace with its own pools, customers, techs, and visit history.",
      "Company admins control access roles — assign techs to specific routes, manage user permissions, and oversee all activity from a centralized dashboard.",
      "Data never leaks between companies. Your proprietary customer relationships, pricing, and service records remain yours alone.",
    ],
  },
]

const steps = [
  {
    number: "01",
    title: "Set up your company",
    description:
      "Create your company profile, invite your techs, and add your first pools with customer details and volume measurements.",
  },
  {
    number: "02",
    title: "Print QR codes & tag pools",
    description:
      "Generate unique QR code stickers for each pool from the dashboard. Affix them to the equipment pad for instant access on every visit.",
  },
  {
    number: "03",
    title: "Test & record readings",
    description:
      "On arrival, techs scan the QR code, run their test strip, and enter the readings into the visit form — right from their phone.",
  },
  {
    number: "04",
    title: "Get doses & share the report",
    description:
      "Poolbench calculates the exact chemical doses needed. After treatment, save the visit and a shareable report is sent to the homeowner automatically.",
  },
]

export default function ServicesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-24 text-white md:px-6 md:py-32">
        <div className="mx-auto max-w-7xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Waves className="size-3.5" />
            Water chemistry, handled
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Our Services
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 md:text-xl">
            Everything your pool-service company needs to test, dose, document, and
            communicate — all in one platform built for the way you work.
          </p>
        </div>
      </section>

      {/* Service sections */}
      {services.map((service, index) => (
        <section
          key={service.title}
          className={cn(
            "px-4 py-16 md:px-6 md:py-24",
            index % 2 === 1 && "bg-muted/30",
          )}
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 md:flex-row md:gap-16">
            <div
              className={cn(
                "w-full md:w-1/2",
                index % 2 === 1 && "md:order-2",
              )}
            >
              <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                <service.icon className="size-7" />
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {service.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {service.shortDesc}
              </p>
              <ul className="mt-6 space-y-3">
                {service.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span className="text-sm leading-6 text-muted-foreground">
                      {detail}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className="mt-8 h-11 bg-sky-600 px-6 text-base text-white hover:bg-sky-700"
              >
                <Link href="/signup">
                  Get started
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </div>
            <div className="w-full md:w-1/2">
              <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 px-8 py-16 dark:from-sky-950/40 dark:to-sky-900/20">
                <service.icon className="size-32 text-sky-300 dark:text-sky-600" />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* How It Works */}
      <section className="bg-muted/30 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Workflow
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From setting up your company to sending the finished report —
              Poolbench makes every step simple.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-600 text-lg font-bold text-white">
                  {step.number}
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-20 text-white md:px-6 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to streamline your pool service?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            See Poolbench in action. Request a personalised demo and we&apos;ll
            show you how it fits your workflow — no commitment, no hassle.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-7 text-base font-semibold text-sky-700 shadow-lg hover:bg-sky-50"
            >
              <Link href="/signup">
                Request a demo
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-12 border border-white/30 bg-transparent px-7 text-base font-semibold text-white shadow-lg hover:bg-white/10"
            >
              <Link href="/login">Sign in free</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
