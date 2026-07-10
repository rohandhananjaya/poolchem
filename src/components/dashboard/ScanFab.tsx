import Link from "next/link"
import { QrCode } from "lucide-react"

/**
 * Floating action button that launches the QR scanner. Sits above the mobile
 * bottom tab bar and clear of the desktop content edge.
 */
export function ScanFab() {
  return (
    <Link
      href="/scan"
      aria-label="Scan pool QR code"
      className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:right-8 md:bottom-8"
    >
      <QrCode className="size-6" />
    </Link>
  )
}
