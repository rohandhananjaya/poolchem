import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ siteKey }: { siteKey: string }) => (
    <div data-testid="turnstile-stub" data-site-key={siteKey} />
  ),
}))

const { TurnstileWidget, isTurnstileEnabled } = await import("./turnstile-widget")

const ORIGINAL_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const ORIGINAL_ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  delete process.env.NEXT_PUBLIC_TURNSTILE_ENABLED
})

afterEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = ORIGINAL_SITE_KEY
  process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = ORIGINAL_ENABLED
})

describe("isTurnstileEnabled", () => {
  it("is false when the site key is unset", () => {
    expect(isTurnstileEnabled()).toBe(false)
  })

  it("is true when the site key is set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"
    expect(isTurnstileEnabled()).toBe(true)
  })

  it("is false when explicitly disabled via env, even with a site key set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = "false"
    expect(isTurnstileEnabled()).toBe(false)
  })
})

describe("TurnstileWidget", () => {
  it("renders nothing when the site key is unset", () => {
    render(<TurnstileWidget onVerify={vi.fn()} />)
    expect(screen.queryByTestId("turnstile-stub")).not.toBeInTheDocument()
  })

  it("renders the widget when the site key is set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"
    render(<TurnstileWidget onVerify={vi.fn()} />)
    expect(screen.getByTestId("turnstile-stub")).toHaveAttribute("data-site-key", "site-key")
  })

  it("renders nothing when explicitly disabled via env, even with a site key set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = "false"
    render(<TurnstileWidget onVerify={vi.fn()} />)
    expect(screen.queryByTestId("turnstile-stub")).not.toBeInTheDocument()
  })
})
