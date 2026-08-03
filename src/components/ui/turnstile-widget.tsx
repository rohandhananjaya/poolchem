"use client"

import { Turnstile } from "@marsidev/react-turnstile"

export function isTurnstileEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "false") return false
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

export function TurnstileWidget({ onVerify, onExpire, className }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!siteKey || !isTurnstileEnabled()) return null

  return (
    <Turnstile
      siteKey={siteKey}
      className={className}
      onSuccess={onVerify}
      onExpire={() => onExpire?.()}
      options={{ theme: "auto", size: "flexible" }}
    />
  )
}
