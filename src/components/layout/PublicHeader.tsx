import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/navigation/mobile-nav"
import { PublicNavLinks } from "./PublicNavLinks"

export interface PublicHeaderProps {
  showSignIn?: boolean
  showMobileMenu?: boolean
  wide?: boolean
  className?: string
  children?: React.ReactNode
}

export function PublicHeader({
  showSignIn = true,
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
        <Link href="/">
          <Image
            src="/images/POOLBENCH.png"
            alt="Poolbench"
            width={140}
            height={36}
            className="h-9 w-auto"
            priority
          />
        </Link>

        <PublicNavLinks />

        <div className="hidden items-center gap-3 md:flex">
          {children ?? (
            <>
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
            </>
          )}
        </div>

        {showMobileMenu && <MobileMenu />}
      </div>
    </header>
  )
}
