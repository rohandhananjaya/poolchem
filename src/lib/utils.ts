import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── Form helpers ────────────────────────────────────────────────── */

/** Reads a required, trimmed text field from a form; returns "" when absent. */
export function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

/** Reads an optional text field: trimmed string, or `null` when empty. */
export function formOptionalText(formData: FormData, key: string): string | null {
  const value = formText(formData, key)
  return value === "" ? null : value
}

/* ── CSS variable helper ─────────────────────────────────────────── */

export function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/* ── Name initials ────────────────────────────────────────────────── */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ── Uptime formatting ───────────────────────────────────────────── */

export function formatUptime(seconds: number, includeSeconds = false): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (includeSeconds) {
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
