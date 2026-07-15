import Link from "next/link"
import { Waves } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/navigation/mobile-nav"

const DEFAULT_NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
  { href: "/contact-us", label: "Contact" },
]

export interface PublicHeaderProps {
  navLinks?: Array<{ href: string; label: string }>
  showSignIn?: boolean
  showPhone?: boolean
  showMobileMenu?: boolean
  wide?: boolean
  className?: string
  children?: React.ReactNode
}

export function PublicHeader({
  navLinks = DEFAULT_NAV_LINKS,
  showSignIn = true,
  showPhone = false,
  showMobileMenu = true,
  wide = false,
  className,
  children,
}: PublicHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 w-full items-center justify-between px-4 md:px-6",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
            <Waves className="size-5" />
          </span>
          <span className="text-lg">Poolbench</span>
        </Link>

        {children ?? (
          <>
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              {navLinks.map((link) => (
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
              {showPhone && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <a href="tel:+15551234567" className="hover:text-foreground transition-colors">
                    +1 (555) 123-4567
                  </a>
                </div>
              )}
              {showSignIn && (
                <Button asChild variant="ghost" size="lg">
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
              <Button asChild size="lg" className="h-10 bg-sky-600 px-5 text-sm text-white hover:bg-sky-700">
                <Link href="/signup">
                  Request a Demo
                </Link>
              </Button>
            </div>

            {showMobileMenu && <MobileMenu />}
          </>
        )}
      </div>
    </header>
  )
}
