import { Award, Check, Droplets, FileText, HeartHandshake, Lightbulb, Target, Users, Waves } from "lucide-react"

import { Button } from "@/components/ui/button"
import Link from "next/link"

const stats = [
  { icon: Waves, value: "10K+", label: "Pools Tracked" },
  { icon: FileText, value: "50K+", label: "Reports Generated" },
  { icon: Users, value: "500+", label: "Companies Using" },
  { icon: Award, value: "99.9%", label: "Uptime" },
]

const values = [
  {
    icon: Droplets,
    title: "Chemistry First",
    description:
      "Every feature starts with the question: does this help a tech balance water faster or more accurately? We don't chase buzzwords — we chase precision.",
  },
  {
    icon: HeartHandshake,
    title: "Built for the Field",
    description:
      "Pool service happens outdoors, one-handed, in bright sun. We design for that reality — big tap targets, readable at a glance, and reliable offline behaviour.",
  },
  {
    icon: Target,
    title: "Radical Transparency",
    description:
      "No hidden markups on chemical doses, no black-box scoring. Every health score, every LSI calculation, every recommendation is reproducible and auditable.",
  },
  {
    icon: Lightbulb,
    title: "Continuous Improvement",
    description:
      "Water chemistry evolves, regulations change, and new testing tools arrive. Poolbench ships year-round so your workflow never falls behind.",
  },
]

const team = [
  {
    name: "Marcus Velez",
    role: "Co-Founder & CEO",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    bio: "20-year pool-service veteran who built the first Poolbench prototype on a napkin between service calls.",
  },
  {
    name: "Sofia Reyes",
    role: "Co-Founder & CTO",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
    bio: "Former water-treatment engineer who brought the LSI algorithm and chemical-dosing engine to life.",
  },
  {
    name: "David Chen",
    role: "Head of Product",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
    bio: "Spent a decade building SaaS for trades. He ensures every feature saves a tech at least one tap.",
  },
  {
    name: "Aisha Patel",
    role: "Head of Customer Success",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    bio: "Onboarded over 300 pool-service companies. She knows exactly where teams get stuck and makes sure they don't stay there.",
  },
]

export default function AboutPage() {
  return (
    <div className="w-full float-left bg-background text-foreground">
      {/* Page Hero Banner */}
      <section className="w-full float-left relative overflow-hidden bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-24 text-white md:px-6 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <Waves className="size-3.5" />
              Water chemistry, handled
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
              About Poolbench
            </h1>
            <p className="mt-4 text-lg leading-8 text-white/80 text-pretty md:text-xl">
              We build tools that turn a quick water test into a clear answer — so
              pool-service professionals can focus on the pool, not the paperwork.
            </p>
          </div>
        </div>
      </section>

      {/* Mission / Story */}
      <section className="w-full float-left px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row">
          <div className="w-full max-w-lg lg:w-1/2">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1576013551627-0cc20b1c5e7c?w=600&h=500&fit=crop"
                alt="Pool service professional at work"
                className="h-auto w-full rounded-2xl object-cover shadow-lg"
                style={{ aspectRatio: "600/500" }}
              />
              <div className="absolute -bottom-4 -right-4 flex size-20 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg">
                <Waves className="size-9" />
              </div>
            </div>
          </div>
          <div className="w-full max-w-xl lg:w-1/2">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Our Mission
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Water chemistry, handled
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Poolbench was born in the back of a service van. Our co-founder
              Marcus was tired of balancing a test-strip colour chart against a
              calculator while sweat dripped onto the clipboard. He knew there had
              to be a better way — so he built it.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Today Poolbench serves hundreds of pool-service companies across
              North America. We still think every decision through the lens of a
              tech on-site: one-handed, sun-glared, under time pressure. If it
              doesn't make their job easier, it doesn't ship.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Real-time water health scoring with LSI verdict",
                "Precise chemical dose recommendations in label units",
                "Professional shareable service reports",
                "QR-code visit start for instant pool history",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="w-full float-left bg-muted/30 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              What We Believe
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Our Core Values
            </h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              Four principles that guide every decision we make and every feature
              we ship.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div
                key={value.title}
                className="flex flex-col rounded-2xl border border-border bg-card p-8 text-center transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                  <value.icon className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="w-full float-left bg-white px-4 py-20 dark:bg-background md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Our Statistics
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Poolbench by the numbers
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                  <stat.icon className="size-6" />
                </span>
                <div className="mt-4 font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
                  {stat.value}
                </div>
                <small className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="w-full float-left bg-muted/30 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Our Team
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Meet the people behind Poolbench
            </h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              A small team with deep roots in pool service and water chemistry.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <img
                  src={member.image}
                  alt={member.name}
                  className="size-24 rounded-full object-cover shadow-sm"
                />
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {member.name}
                </h3>
                <span className="mt-1 text-sm font-medium text-sky-600 dark:text-sky-400">
                  {member.role}
                </span>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full float-left bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-20 text-white md:px-6 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to streamline your pool service?
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/80 text-pretty">
            Join hundreds of companies that trust Poolbench to handle their water
            chemistry, reporting, and scheduling.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-7 text-base font-semibold text-sky-700 shadow-lg hover:bg-sky-50"
            >
              <Link href="/signup">
                Start free
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-12 bg-sky-600 px-7 text-base font-semibold text-white shadow-lg hover:bg-sky-700"
            >
              <Link href="/login">
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
