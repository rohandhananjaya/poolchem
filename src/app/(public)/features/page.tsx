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

import { Button } from "@/components/ui/button"

const features = [
  {
    icon: Activity,
    title: "Water Health Scoring",
    paragraphs: [
      "Every pool test produces a stack of raw numbers — pH, alkalinity, calcium hardness, cyanuric acid, and more. Poolbench translates those numbers into a single, intuitive health score from 0 to 100, alongside a clear Langelier Saturation Index (LSI) verdict.",
      "The LSI tells you whether the water is balanced, corrosive, or scaling. A corrosive pool eats at equipment and surfaces; a scaling pool clogs filters and leaves deposits. With Poolbench, you catch these conditions immediately — before they turn into expensive repairs.",
    ],
    benefits: [
      "Instant 0–100 health score from any test reading",
      "Clear LSI verdict: balanced, corrosive, or scaling",
      "Historical score tracking to spot trends over time",
      "Colour-coded bands for at-a-glance status",
    ],
    image:
      "https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=800&h=500&fit=crop",
    imageAlt: "Water test kit and pool water sample",
  },
  {
    icon: Beaker,
    title: "Chemical Dose Recommendations",
    paragraphs: [
      "Figuring out how much chemical to add is the most error-prone part of any service call. Poolbench eliminates guesswork: enter your test readings and the pool volume, and the engine calculates the exact dose of each chemical needed to bring every parameter into range.",
      "Results are returned in the same units printed on the chemical label — ounces, pounds, quarts, or gallons — so there is no conversion math. Whether you are adjusting pH with soda ash or shocking with calcium hypochlorite, the dose is precise and repeatable.",
    ],
    benefits: [
      "Exact dose calculations based on pool volume and readings",
      "Results in label units — no conversion required",
      "Supports all major pool chemicals and adjustments",
      "Reduces chemical waste and overdosing incidents",
    ],
    image:
      "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&h=500&fit=crop",
    imageAlt: "Pool chemicals arranged on a table",
  },
  {
    icon: FileText,
    title: "Shareable Service Reports",
    paragraphs: [
      "Every visit generates a professional, easy-to-read service report that you can share with the homeowner instantly. The report includes before-and-after readings, the health score, the chemicals added with exact doses, and any notes the tech left.",
      "Homeowners get a public link — no login required, no app to install. They can view the report on any device or keep it for their records. It is a simple touch that builds trust and shows the value of your service.",
    ],
    benefits: [
      "Professional reports generated automatically per visit",
      "Public shareable link — no account needed to view",
      "Includes readings, doses, score, and tech notes",
      "Printable and mobile-friendly for homeowners",
    ],
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop",
    imageAlt: "Service report on a tablet by the pool",
  },
  {
    icon: QrCode,
    title: "Scan to Start a Visit",
    paragraphs: [
      "Every pool gets a unique QR code tag that techs scan on arrival. One scan opens the visit form with the pool's full history — past readings, chemical trends, equipment notes, and the last service date — already loaded and ready.",
      "No more typing in pool names or flipping through paper files. The scan also auto-timestamps the arrival, so you get accurate visit logging without any extra steps. It is the fastest way to start a service call and stay organised.",
    ],
    benefits: [
      "Instant pool lookup with a single QR code scan",
      "Full visit history and trends pre-loaded on arrival",
      "Auto-timestamped arrival logging for accurate records",
      "Weatherproof QR tags that mount to equipment pads",
    ],
    image:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=500&fit=crop",
    imageAlt: "Smartphone scanning a QR code at a pool equipment pad",
  },
  {
    icon: CalendarClock,
    title: "Scheduling & History",
    paragraphs: [
      "Stay on top of every pool with a clear schedule of upcoming visits. The calendar view shows all your routes for the day, week, or month, with pool names, addresses, and the last service date for each stop.",
      "Every completed visit is saved permanently. You can browse the full history of any pool — readings, scores, doses, and notes — going back months or years. Trend charts show how water health has changed over time, helping you spot chronic issues before they become emergencies.",
    ],
    benefits: [
      "Daily, weekly, and monthly calendar views for route planning",
      "Full visit history with every reading and dose recorded",
      "Water-health trend charts for early problem detection",
      "All data is backed up and searchable across every pool",
    ],
    image:
      "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&h=500&fit=crop",
    imageAlt: "Calendar and scheduling view on a tablet",
  },
  {
    icon: ShieldCheck,
    title: "Built for Teams",
    paragraphs: [
      "Poolbench is multi-tenant by design. Every pool, visit, reading, and report belongs to a single company — your data never leaks or mixes with anyone else's. Add as many techs as you need, each with their own login and role-based permissions.",
      "Company owners see the big picture: all pools, all techs, all visits in one place. Techs see only their assigned routes and pools. It scales from a solo operator running one truck to a large service company with dozens of techs and thousands of pools.",
    ],
    benefits: [
      "Multi-company architecture — data stays in your tenant",
      "Role-based permissions for managers and techs",
      "Unlimited pool and team member capacity",
      "Scales from one truck to enterprise fleets",
    ],
    image:
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=500&fit=crop",
    imageAlt: "Pool service team collaborating on site",
  },
]

export default function FeaturesPage() {
  return (
    <div className="w-full float-left bg-background text-foreground">
      {/* Hero */}
      <section className="w-full float-left relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-500 to-cyan-500 px-4 py-24 text-white md:px-6 md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Waves className="size-3.5" />
            Everything a service call needs
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Features
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 md:text-xl">
            Poolbench gives pool-service professionals everything they need to
            test, treat, and report — all from one app. No spreadsheets, no
            guesswork, no paper.
          </p>
        </div>
      </section>

      {/* Feature detail sections */}
      {features.map((feature, index) => (
        <section
          key={feature.title}
          className={`w-full float-left px-4 py-20 md:px-6 md:py-28 ${
            index % 2 === 0
              ? "bg-white dark:bg-background"
              : "bg-muted/30"
          }`}
        >
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row">
            {/* Image */}
            <div
              className={`w-full lg:w-1/2 ${
                index % 2 === 1 ? "lg:order-2" : ""
              }`}
            >
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={feature.image}
                  alt={feature.imageAlt}
                  className="h-64 w-full object-cover sm:h-72 md:h-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <span className="absolute bottom-4 left-4 flex size-12 items-center justify-center rounded-xl bg-white/90 text-sky-600 shadow-sm backdrop-blur-sm dark:bg-sky-900/80 dark:text-sky-300">
                  <feature.icon className="size-6" />
                </span>
              </div>
            </div>

            {/* Content */}
            <div
              className={`w-full lg:w-1/2 ${
                index % 2 === 1 ? "lg:order-1" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 lg:hidden">
                  <feature.icon className="size-5" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {feature.title}
                </h2>
              </div>
              {feature.paragraphs.map((paragraph, i) => (
                <p
                  key={i}
                  className="mt-4 text-base leading-7 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              <ul className="mt-6 space-y-3">
                {feature.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                      <Check className="size-3" />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="w-full float-left bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-20 text-white md:px-6 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to transform your pool service?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Join hundreds of pool-service companies already using Poolbench to
            save time, reduce chemical waste, and impress their customers.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-7 text-base font-semibold text-sky-700 shadow-lg hover:bg-sky-50"
            >
              <Link href="/signup">
                Start free
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-12 border border-white/30 bg-white/10 px-7 text-base font-semibold text-white shadow-lg backdrop-blur-sm hover:bg-white/20"
            >
              <Link href="/login">
                Sign in
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-white/60">
            No credit card required. Set up your company in minutes.
          </p>
        </div>
      </section>
    </div>
  )
}
