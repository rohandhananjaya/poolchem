import Link from "next/link"
import Image from "next/image"
import { ChevronRight, Send } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PublicFooterProps {
  showSocial?: boolean
  className?: string
}

const usefulLinks = ["Home", "About us", "Services", "Blog", "Contact us", "Privacy", "Terms"]
const productLinks = ["Features", "Pricing", "Documentation"]

const socialLinks = [
  {
    href: "https://facebook.com",
    icon: (
      <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    href: "https://x.com",
    icon: (
      <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: "https://instagram.com",
    icon: (
      <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
]

export function PublicFooter({ showSocial = false, className }: PublicFooterProps) {
  return (
    <>
      <footer className={cn("bg-sky-900 px-4 pt-16 pb-8 text-white md:px-6", className)}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <img
                src="/images/POOLBENCH_WHITE.png"
                alt="Poolbench"
                width={160}
                className="mb-4"
              />
              <p className="text-sm leading-relaxed text-sky-100/70">
                Streamline your pool-service operation with Poolbench. Manage
                visits, track water health, and keep your clients informed.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">Useful Links</h4>
              <ul className="space-y-2.5 text-sm text-sky-100/70">
                {usefulLinks.map((item) => (
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
                {productLinks.map((item) => (
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
              {showSocial && (
                <div className="mt-6">
                  <ul className="flex gap-3">
                    {socialLinks.map((social) => (
                      <li key={social.href}>
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex size-9 items-center justify-center rounded-full border border-sky-700 text-sky-300 transition-colors hover:border-sky-400 hover:text-white"
                        >
                          {social.icon}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
      <div className="border-t border-sky-800 bg-sky-950 px-4 py-5 text-center md:px-6">
        <span className="text-sm text-sky-300/70">
          &copy; 2026 Poolbench. Water chemistry, handled.
        </span>
      </div>
    </>
  )
}
