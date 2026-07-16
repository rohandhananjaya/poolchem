import type { Metadata } from "next"
import Link from "next/link"
import {
  BookOpen,
  Code,
  Beaker,
  Radio,
  Shield,
  Package,
  Search,
  ChevronRight,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Documentation | Poolbench",
  description:
    "Learn how to use Poolbench with our comprehensive documentation. Get started with water testing, scheduling, reports, and the API.",
  openGraph: {
    title: "Documentation | Poolbench",
    description:
      "Learn how to use Poolbench with our comprehensive documentation. Get started with water testing, scheduling, reports, and the API.",
    url: "/documentation",
  },
  alternates: { canonical: "/documentation" },
}

const docSections = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description:
      "Learn the basics of Poolbench — create your account, set up your company, and configure your first pool.",
  },
  {
    icon: Code,
    title: "API Reference",
    description:
      "Full API documentation for programmatic access to pools, readings, reports, and company data.",
  },
  {
    icon: Beaker,
    title: "Pool Chemistry Guide",
    description:
      "Understand water chemistry fundamentals, LSI calculations, and how Poolbench scores water health.",
  },
  {
    icon: Radio,
    title: "Webhooks",
    description:
      "Configure webhooks to receive real-time events for visits, readings, and report generation.",
  },
  {
    icon: Shield,
    title: "Authentication",
    description:
      "OAuth, API keys, session management, and multi-tenant auth patterns for secure integrations.",
  },
  {
    icon: Package,
    title: "SDK & Libraries",
    description:
      "Client libraries, CLI tools, and community SDKs to integrate Poolbench into your workflow.",
  },
]

const quickLinks = [
  "Account Setup",
  "Creating a Pool",
  "Taking a Reading",
  "Generating Reports",
  "Managing Teams",
  "Billing & Plans",
]

export default function DocumentationPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-16">
      {/* Hero */}
      <section className="mb-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Documentation
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
          Everything you need to integrate Poolbench into your pool-service
          workflow.
        </p>
        <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          <span>Search documentation&hellip;</span>
        </div>
      </section>

      {/* Doc Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docSections.map((section) => (
          <Link
            key={section.title}
            href="#"
            className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
              <section.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold text-foreground">
              {section.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {section.description}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-600 transition-colors group-hover:text-sky-700 dark:text-sky-400 dark:group-hover:text-sky-300">
              Learn more
              <ChevronRight className="size-3.5" />
            </span>
          </Link>
        ))}
      </section>

      {/* Quick Links */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Links
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((label) => (
            <Link
              key={label}
              href="#"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
            >
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
