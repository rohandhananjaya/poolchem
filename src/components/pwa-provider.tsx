"use client"

import { useState } from "react"

import { SerwistProvider } from "@serwist/turbopack/react"

// Service workers only register on origins whose TLS certificate the browser
// trusts. In dev the server runs on a self-signed cert that is valid for
// localhost only, so a phone hitting the LAN IP (e.g. https://192.168.8.118)
// cannot fetch /serwist/sw.js and registration throws a SecurityError in the
// console. Gate registration to contexts where it can actually succeed:
// a secure context AND (localhost in dev, or any origin in production).
function canRegister(): boolean {
  if (typeof window === "undefined") return false
  if (!window.isSecureContext) return false
  if (process.env.NODE_ENV === "production") return true
  const { hostname } = window.location
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [register] = useState(canRegister)
  return (
    <SerwistProvider swUrl="/serwist/sw.js" register={register}>
      {children}
    </SerwistProvider>
  )
}
