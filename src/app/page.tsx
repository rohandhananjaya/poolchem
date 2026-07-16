import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  Beaker,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Droplets,
  FileText,
  Play,
  QrCode,
  ShieldCheck,
  Star,
  Users,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { PublicFooter } from "@/components/layout/PublicFooter"
import { blogPosts } from "@/lib/blog"

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
      "Enter the test readings and pool volume; Poolbench returns the exact chemical doses needed to bring the water back into range — in the units on the label.",
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

const stats = [
  { icon: Waves, value: "10K+", label: "Pools Tracked" },
  { icon: FileText, value: "50K+", label: "Reports Generated" },
  { icon: Users, value: "500+", label: "Companies Using" },
  { icon: Award, value: "99.9%", label: "Uptime" },
];

const testimonials = [
  {
    name: "Anshuman Kishore",
    title: "Marketing Manager, Porsche Centre Dubai",
    quote:
      "Poolbench has completely transformed how our team manages pool chemistry. The health scoring alone saves us hours of manual calculation every week.",
    rating: 5,
  },
  {
    name: "Clare Smyth",
    title: "Pool Service Owner",
    quote:
      "My techs love the QR code scan feature. They walk up, scan, and everything they need is right there. The reports have also been a huge hit with our residential clients.",
    rating: 5,
  },
  {
    name: "Jamie Oliver",
    title: "Facilities Manager",
    quote:
      "Being able to track water health trends over time has helped us catch issues before they become problems. Highly recommended for any multi-pool operation.",
    rating: 5,
  },
];

const featuredPosts = blogPosts.slice(0, 3);

export default function Home() {
  return (
    <div className="w-full float-left bg-background text-foreground">
      <PublicHeader
        showSignIn={false}
        showMobileMenu={false}
        wide
        className="static bg-white shadow-sm dark:bg-card"
      >
        <Button asChild size="lg" className="h-10 bg-sky-600 px-5 text-sm text-white hover:bg-sky-700">
          <Link href="/signup">
            Request a Demo
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </PublicHeader>

      {/* Hero */}
      <section className="w-full float-left banner-con relative overflow-hidden bg-cover bg-top bg-no-repeat text-white"
        style={{ backgroundImage: "url(/images/pool-bg.jpg)" }}>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sky-950/80 via-sky-800/40 to-transparent md:via-sky-800/20" />

        {/* Social sidebar */}
        <ul className="fixed left-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-5 md:flex">
          <li>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-full border border-white/30 text-white/80 transition-colors hover:border-white hover:text-white">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
          </li>
          <li>
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-full border border-white/30 text-white/80 transition-colors hover:border-white hover:text-white">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </li>
          <li>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-full border border-white/30 text-white/80 transition-colors hover:border-white hover:text-white">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </li>
        </ul>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-24 md:px-6 md:py-32">
          <div className="banner-title flex max-w-3xl flex-col items-start text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <Droplets className="size-3.5" />
              Water chemistry, handled
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl">
              Perfectly balanced pools,{" "}
              <span >every visit</span>.
            </h1>
             <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 text-pretty md:text-xl [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]">
              Poolbench turns a quick water test into a health score, the exact
              chemical doses to fix it, and a report your customers actually
              understand. Built for pool-service companies and their techs.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
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
                className="h-12 bg-sky-600 px-7 text-base font-semibold text-white shadow-lg hover:bg-sky-700"
              >
                <Link href="#features">
                  See how it works
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-white/60">
              No credit card required. Set up your company in minutes.
            </p>
          </div>
        </div>

        {/* Wave SVG */}
        <div className="banner-wave absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg
            className="waves relative block w-full"
            style={{ height: "80px", maxHeight: "140px" }}
            viewBox="0 24 150 28"
            preserveAspectRatio="none"
            shapeRendering="auto"
          >
            <defs>
              <path
                id="gentle-wave"
                d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
              />
            </defs>
            <use
              href="#gentle-wave"
              x={48}
              y={0}
              fill="rgba(14,165,233,0.7)"
              className="animate-wave-flow"
              style={{ animationDuration: "7s" }}
            />
            <use
              href="#gentle-wave"
              x={48}
              y={3}
              fill="rgba(255,255,255,0.5)"
              className="animate-wave-flow"
              style={{ animationDuration: "5.5s" }}
            />
            <use
              href="#gentle-wave"
              x={48}
              y={5}
              fill="rgba(255,255,255,0.3)"
              className="animate-wave-flow"
              style={{ animationDuration: "4s" }}
            />
            <use
              href="#gentle-wave"
              x={48}
              y={7}
              fill="#f0f9ff"
              className="animate-wave-flow"
              style={{ animationDuration: "3.5s" }}
            />
          </svg>
        </div>

        {/* Scroll down indicator */}
        <a
          href="#features"
          className="top-btn absolute -bottom-6 left-1/2 z-10 hidden -translate-x-1/2 animate-bounce md:block"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
            <ArrowRight className="size-4 rotate-90" />
          </span>
        </a>
      </section>

      {/* Services / Features */}
      <section
        id="features"
        className="w-full float-left service-con bg-white px-4 py-20 dark:bg-background md:px-6 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="generic-title mx-auto mb-14 max-w-2xl text-center">
            <span className="d-inline-block mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Our Services
            </span>
            <h2 className="mb-0 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a service call needs
            </h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              From the first test strip to the report in the homeowner&apos;s inbox,
              Poolbench covers the whole visit.
            </p>
          </div>
          <div className="service-box grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="service-item group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="service-img relative overflow-hidden">
                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950/40 dark:to-sky-900/20">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-white/80 text-sky-600 shadow-sm backdrop-blur-sm dark:bg-sky-900/70 dark:text-sky-300">
                      <feature.icon className="size-7" />
                    </span>
                  </div>
                </div>
                <div className="service-content p-6">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                  <Link
                    href="/signup"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    Read More
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="w-full float-left about-con bg-muted/100 px-4 py-20 md:px-6 md:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row">
          <div className="about-img w-full max-w-lg lg:w-1/2">
            <div className="relative">
              <img
                src="/images/about-hero-service.jpg"
                alt="Pool service"
                className="about-small-img h-auto w-full rounded-2xl object-cover shadow-lg"
                style={{ aspectRatio: "600/500" }}
              />
              <div className="about-icon absolute -bottom-4 -right-4 flex size-20 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg">
                <Waves className="size-9" />
              </div>
            </div>
          </div>
          <div className="about-content w-full max-w-xl lg:w-1/2">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              About Us
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Water chemistry, handled
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Poolbench was built by pool-service professionals who were tired of
              juggling test strips, calculators, and spreadsheets. We set out to
              build a single tool that does the math, tracks the history, and
              generates the reports — so techs can focus on the pool, not the
              paperwork.
            </p>
            <div className="generic-list mt-6 space-y-3">
              {[
                "Real-time water health scoring with LSI verdict",
                "Precise chemical dose recommendations",
                "Professional shareable service reports",
                "QR-code visit start for instant pool history",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <div className="generic-btn mt-8">
              <Button
                asChild
                size="lg"
                className="h-11 bg-sky-600 px-6 text-base text-white hover:bg-sky-700"
              >
                <Link href="/signup">
                  Learn More
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Request a Demo / Quote Form */}
      <section
        id="contact"
        className="w-full float-left mian-form-con bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-20 text-white md:px-6 md:py-28"
      >
        <div className="form-box mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row">
          <div className="form-con w-full max-w-lg lg:w-1/2">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-200">
              Get Started
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Request a Demo
            </h2>
            <p className="mt-4 text-base leading-7 text-white/80">
              See how Poolbench can streamline your pool-service operation. Fill
              out the form and we&apos;ll reach out within one business day.
            </p>
            <form
              className="contact-form mt-8"
              action="#"
            >
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Name"
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <input
                  type="text"
                  placeholder="Company"
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <textarea
                  placeholder="Message"
                  rows={4}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <button
                  type="submit"
                  className="submit-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-sky-700 shadow-lg transition-colors hover:bg-sky-50"
                >
                  Submit Now
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </form>
          </div>
          <div className="form-icon hidden w-full max-w-sm lg:block lg:w-1/2">
            <div className="flex items-center justify-center">
              <div className="form-clean-box relative">
                <div className="flex size-72 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                  <Waves className="size-32 text-white/60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="w-full float-left static-con bg-white px-4 py-20 dark:bg-background md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="generic-title mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Our Statistics
            </span>
            <h2 className="mb-0 text-3xl font-bold tracking-tight sm:text-4xl">
              Poolbench by the numbers
            </h2>
          </div>
          <div className="static-box grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="static-box-item flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                  <stat.icon className="size-6" />
                </span>
                <div className="staic-value mt-4 font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
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

      {/* Video Section */}
      <section className="w-full float-left vedio-con relative overflow-hidden bg-muted/100 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="vedio-content text-center">
            <a
              href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              target="_blank"
              rel="noopener noreferrer"
              className="icon group mx-auto mb-10 flex size-24 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg transition-transform hover:scale-110"
            >
              <Play className="ml-1 size-10" />
            </a>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              See Poolbench in Action
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Watch how a pool-service tech goes from test strip to finished report
              in under five minutes — all from their phone.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="w-full float-left tesimonials-con bg-white px-4 py-20 dark:bg-background md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="generic-title mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Testimonials
            </span>
            <h2 className="mb-0 text-3xl font-bold tracking-tight sm:text-4xl">
              What Our Clients are Saying
            </h2>
          </div>
          <div className="slider-box grid gap-8 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="review-details-box rounded-2xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="stars-img mb-4 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="customer-status mt-6 border-t border-border pt-4">
                  <h5 className="text-sm font-semibold">{t.name}</h5>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {t.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog / News */}
      <section
        id="blog"
        className="w-full float-left blog-con bg-muted/100 px-4 py-20 md:px-6 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="generic-title mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              News &amp; Articles
            </span>
            <h2 className="mb-0 text-3xl font-bold tracking-tight sm:text-4xl">
              Our Latest Blog Posts
            </h2>
          </div>
          <div className="blog-box grid gap-8 md:grid-cols-3">
            {featuredPosts.map((post) => (
              <div
                key={post.title}
                className="blog-box-item overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <figure className="mb-0 overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </figure>
                <div className="blog-box-content p-6">
                  <div className="blog-date text-xs text-muted-foreground">
                    {post.date} &mdash; {post.comments} Comments
                  </div>
                    <h4 className="mt-3 text-base font-semibold leading-snug tracking-tight">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-sky-600 transition-colors dark:hover:text-sky-400"
                    >
                      {post.title}
                    </Link>
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="read-btn mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    Read More
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter showSocial className="w-full float-left" />
    </div>
  );
}
