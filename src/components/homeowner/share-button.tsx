"use client"

import { useCallback, useState } from "react"
import { Check, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface ShareButtonProps {
  /** Absolute URL of this dashboard. */
  url: string
  /** Pool name, used in the native share sheet title. */
  poolName: string
}

/**
 * "Share this dashboard" action for the public homeowner page.
 *
 * Uses the Web Share API where available (mobile — opens the OS share sheet),
 * and otherwise falls back to copying the link to the clipboard with brief
 * "Link copied" feedback. A final fallback prompts with the raw URL when the
 * clipboard is unavailable (insecure context / denied permission).
 */
export function ShareButton({ url, poolName }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const shareUrl = url || window.location.href

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${poolName} — Pool Dashboard`,
          text: `Check on ${poolName}'s water health`,
          url: shareUrl,
        })
        return
      } catch {
        // User dismissed the share sheet, or it failed — fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this dashboard link:", shareUrl)
    }
  }, [url, poolName])

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleShare}
      className="bg-brand-600 text-white hover:bg-brand-900"
    >
      {copied ? <Check className="text-white" /> : <Share2 />}
      {copied ? "Link copied" : "Share this dashboard"}
    </Button>
  )
}
