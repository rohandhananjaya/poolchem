import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Beaker,
  CalendarClock,
  Droplets,
  FileText,
  QrCode,
  ShieldCheck,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Activity,
    title: "Water health scoring",
    description:
      "Every reading is scored 0–100 with a Langelier Saturation Index verdict, so techs know at a glance whether the water is balanced, corrosive, or scaling.",
  },
  {
    icon: Beaker,
    title: "Chemical dose recommendations",
    description:
      "Enter the test readings and pool volume; PoolChem returns the exact chemical doses needed to bring the water back into range — in the units on the label.",
  },
  {
    icon: FileText,
    title: "Shareable service reports",
    description:
      "Each visit generates a clean report you can hand to the homeowner. They get a public link — no login, no app to install.",
  },
  {
    icon: QrCode,
    title: "Scan to start a visit",
    description:
      "Tag a pool with a QR code. Techs scan on arrival to open the right visit form instantly, with the pool's history already loaded.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling & history",
    description:
      "See upcoming visits, track water-health trends over time, and never lose the record of what was dosed and when.",
  },
  {
    icon: ShieldCheck,
    title: "Built for teams",
    description:
      "Multi-company by design. Every pool, visit, and reading is scoped to your company — your data never mixes with anyone else's.",
  },
];

const steps = [
  {
    step: "01",
    title: "Test the water",
    description:
      "Your tech records pH, chlorine, alkalinity, hardness and stabilizer — right from their phone at the pool.",
  },
  {
    step: "02",
    title: "Get the verdict",
    description:
      "PoolChem scores the water and recommends the precise chemicals and amounts to bring it into balance.",
  },
  {
    step: "03",
    title: "Share the report",
    description:
      "Complete the visit and send the homeowner a polished report with everything that was measured and added.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Waves className="size-5" />
            </span>
            <span className="text-lg">PoolChem</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/login">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Ambient water gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-sky-50 via-background to-background dark:from-sky-950/30 dark:via-background dark:to-background"
          />
          <div className="mx-auto w-full max-w-6xl px-4 py-20 md:px-6 md:py-28">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
                <Droplets className="size-3.5" />
                Water chemistry, handled
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Perfectly balanced pools,{" "}
                <span className="text-sky-600 dark:text-sky-400">every visit</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground text-pretty">
                PoolChem turns a quick water test into a health score, the exact
                chemical doses to fix it, and a report your customers actually
                understand. Built for pool-service companies and their techs.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 px-5 text-base">
                  <Link href="/login">
                    Start free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                No credit card required. Set up your company in minutes.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything a service call needs
            </h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              From the first test strip to the report in the homeowner&apos;s inbox,
              PoolChem covers the whole visit.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-4 bg-card p-6 transition-colors hover:bg-muted/40 md:p-8"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                  <feature.icon className="size-5.5" />
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Three steps, poolside
              </h2>
              <p className="mt-4 text-lg text-muted-foreground text-pretty">
                No spreadsheets, no guesswork, no calculator on the truck.
              </p>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.step} className="relative flex flex-col gap-3">
                  <span className="font-mono text-sm font-semibold text-sky-600 dark:text-sky-400">
                    {step.step}
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <div className="relative overflow-hidden rounded-3xl bg-sky-600 px-6 py-14 text-center shadow-lg md:px-16 md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-sky-400/40 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-sky-300/30 blur-3xl"
            />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-white text-balance sm:text-4xl">
                Give every tech a chemist in their pocket
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-sky-50/90 text-pretty">
                Join the pool-service companies using PoolChem to balance water
                faster and keep customers happy.
              </p>
              <div className="mt-9 flex justify-center">
                <Button
                  asChild
                  size="lg"
                  className="h-11 bg-white px-6 text-base text-sky-700 hover:bg-sky-50"
                >
                  <Link href="/login">
                    Get started
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:px-6">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-sky-500 text-white">
              <Waves className="size-4" />
            </span>
            PoolChem
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
          <p>© 2026 PoolChem. Water chemistry, handled.</p>
        </div>
      </footer>
    </div>
  );
}
