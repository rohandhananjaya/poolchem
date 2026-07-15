import Link from "next/link"
import { Check, HelpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

const tiers = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    description:
      "Perfect for getting started with pool water chemistry tracking.",
    features: [
      "Up to 5 pools",
      "Basic water health scoring",
      "Chemical dose recommendations",
      "Email support",
    ],
    cta: { label: "Get started", href: "/signup" },
    featured: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description:
      "For growing pool service companies with multiple techs.",
    features: [
      "Up to 50 pools",
      "Advanced water health scoring with LSI",
      "Unlimited service reports",
      "QR code visit start",
      "Scheduling & history",
      "Priority support",
    ],
    cta: { label: "Start free trial", href: "/signup" },
    featured: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description:
      "For large operations with custom needs and dedicated support.",
    features: [
      "Unlimited pools & techs",
      "All Professional features",
      "Custom integrations",
      "Dedicated account manager",
      "SSO & advanced security",
      "99.9% SLA guarantee",
      "Custom branding",
    ],
    cta: { label: "Contact us", href: "/contact-us" },
    featured: true,
  },
]

const faqs = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate your billing accordingly.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Absolutely. All paid plans come with a 14-day free trial, no credit card required. You'll get full access to all features during the trial period.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards, including Visa, Mastercard, and American Express. Enterprise customers can also pay via invoice with net-30 terms.",
  },
  {
    question: "How does multi-company data isolation work?",
    answer:
      "Each company gets its own isolated workspace. Pools, visits, and readings are scoped to your company — your data never mixes with anyone else's. You can manage users and roles from the settings panel.",
  },
]

export default function PricingPage() {
  return (
    <>
      {/* Hero + Pricing Cards */}
      <section className="w-full bg-white px-4 py-20 dark:bg-background md:px-6 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Pricing
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              No hidden fees. No surprises. Start for free and scale as
              you grow.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border bg-card p-8 ${
                  tier.featured
                    ? "border-sky-500 shadow-lg ring-1 ring-sky-500"
                    : "border-border"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm text-muted-foreground">
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {tier.description}
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  className={`mt-8 h-11 w-full text-base ${
                    tier.featured
                      ? "bg-sky-600 text-white hover:bg-sky-700"
                      : "bg-primary text-primary-foreground hover:bg-primary/80"
                  }`}
                >
                  <Link href={tier.cta.href}>{tier.cta.label}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full bg-muted/30 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              FAQ
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {faq.question}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="w-full bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-20 text-white md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/80">
            Join hundreds of pool service professionals who trust
            Poolbench to manage their water chemistry.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-7 text-base font-semibold text-sky-700 shadow-lg hover:bg-sky-50"
            >
              <Link href="/signup">Start free trial</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-12 bg-sky-800 px-7 text-base font-semibold text-white shadow-lg hover:bg-sky-900"
            >
              <Link href="/contact-us">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
