import Link from "next/link"
import { ChevronRight, Mail, MapPin, Phone, Waves, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/navigation/mobile-nav"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
  { href: "/contact-us", label: "Contact" },
]

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Waves className="size-5" />
            </span>
            <span className="text-lg">Poolbench</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            {navLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="lg" className="h-10 bg-sky-600 px-5 text-sm text-white hover:bg-sky-700">
              <Link href="/signup">
                Request a Demo
              </Link>
            </Button>
          </div>

          <MobileMenu />
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-sky-900 px-4 pt-16 pb-8 text-white md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500 text-white">
                  <Waves className="size-5" />
                </span>
                <span className="text-lg">Poolbench</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-sky-100/70">
                <li className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-sky-400" />
                  <a href="tel:+15551234567" className="hover:text-white transition-colors">
                    +1 (555) 123-4567
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="size-4 shrink-0 text-sky-400" />
                  <a href="mailto:hello@poolbench.app" className="hover:text-white transition-colors">
                    hello@poolbench.app
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-sky-400" />
                  <span>San Francisco, CA 94105</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">Useful Links</h4>
              <ul className="space-y-2.5 text-sm text-sky-100/70">
                {["Home", "About us", "Services", "Blog", "Contact us", "Privacy", "Terms"].map((item) => (
                  <li key={item}>
                    <Link
                      href={item === "Home" ? "/" : `/${item.toLowerCase().replace(/\s+/g, "-")}`}
                      className="inline-flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <ChevronRight className="size-3 text-sky-400" />
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">Product</h4>
              <ul className="space-y-2.5 text-sm text-sky-100/70">
                {["Features", "Pricing", "Documentation"].map((item) => (
                  <li key={item}>
                    <Link
                      href={`/${item.toLowerCase()}`}
                      className="inline-flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <ChevronRight className="size-3 text-sky-400" />
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">Our Newsletter</h4>
              <div className="flex overflow-hidden rounded-xl border border-sky-700 bg-sky-800">
                <input
                  type="email"
                  placeholder="Email Address"
                  className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-sky-300 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex shrink-0 items-center justify-center bg-sky-600 px-4 text-white transition-colors hover:bg-sky-500"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <div className="border-t border-sky-800 bg-sky-950 px-4 py-5 text-center md:px-6">
        <span className="text-sm text-sky-300/70">
          &copy; 2026 Poolbench. Water chemistry, handled.
        </span>
      </div>
    </div>
  )
}
