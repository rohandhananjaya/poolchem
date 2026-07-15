"use client"

import Link from "next/link"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
  { href: "/contact-us", label: "Contact" },
]

export function PublicNavLinks() {
  return (
    <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="hover:text-foreground transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
