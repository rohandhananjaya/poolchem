import { Clock, ArrowRight, Waves } from "lucide-react"

import { Button } from "@/components/ui/button"

const officeHours = [
  { day: "Monday – Friday", hours: "9:00 AM – 6:00 PM PST" },
  { day: "Saturday", hours: "10:00 AM – 2:00 PM PST" },
  { day: "Sunday", hours: "Closed" },
]

export default function ContactUsPage() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 to-sky-500 px-4 py-20 text-white md:px-6 md:py-28">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Waves className="size-3.5" />
            Get in touch
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Contact Us
          </h1>
          <p className="mt-4 text-lg text-white/80 text-pretty">
            Have a question about Poolbench? Want to see it in action? We&apos;d
            love to hear from you. Fill out the form below and we&apos;ll get back
            to you within one business day.
          </p>
        </div>
      </section>



      {/* Demo Request Form + Office Hours */}
      <section className="bg-muted/30 px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-5">
            {/* Form */}
            <div className="lg:col-span-3">
              <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                Get Started
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Request a Demo
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                See how Poolbench can streamline your pool-service operation. Fill
                out the form and we&apos;ll reach out within one business day.
              </p>
              <form className="contact-form mt-8" action="#">
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Name"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <textarea
                    placeholder="Message"
                    rows={4}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <Button
                    type="submit"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg transition-colors hover:bg-sky-700"
                  >
                    Submit Now
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            </div>

            {/* Office Hours & Response Time */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                    <Clock className="size-5" />
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">
                    Office Hours
                  </h3>
                </div>
                <div className="mt-6 space-y-4">
                  {officeHours.map((item) => (
                    <div
                      key={item.day}
                      className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {item.day}
                      </span>
                      <span
                        className={`text-sm ${
                          item.hours === "Closed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.hours}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-foreground">
                  Response Time
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  We typically respond to inquiries within <strong>one business
                  day</strong>. For urgent matters, give us a call during office
                  hours and we&apos;ll help you right away.
                </p>
              </div>


            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
