import { describe, expect, it, beforeEach, vi } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const { verifyTurnstileToken } = await import("@/lib/turnstile")

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.TURNSTILE_SECRET_KEY
  delete process.env.NEXT_PUBLIC_TURNSTILE_ENABLED
})

describe("verifyTurnstileToken", () => {
  it("returns true without calling fetch when TURNSTILE_SECRET_KEY is unset", async () => {
    const result = await verifyTurnstileToken("any-token")

    expect(result).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns true without calling fetch when explicitly disabled via env, even with a secret and bad token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = "false"

    const result = await verifyTurnstileToken("")

    expect(result).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns false for an empty token when the secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"

    const result = await verifyTurnstileToken("")

    expect(result).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns true when Cloudflare responds success: true", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    mockFetch.mockResolvedValue(jsonResponse({ success: true }))

    const result = await verifyTurnstileToken("good-token")

    expect(result).toBe(true)
  })

  it("returns false when Cloudflare responds success: false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    mockFetch.mockResolvedValue(jsonResponse({ success: false }))

    const result = await verifyTurnstileToken("bad-token")

    expect(result).toBe(false)
  })

  it("returns false on a non-2xx response", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    mockFetch.mockResolvedValue(jsonResponse({ success: true }, false))

    const result = await verifyTurnstileToken("token")

    expect(result).toBe(false)
  })

  it("fails closed when fetch rejects", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    mockFetch.mockRejectedValue(new Error("network down"))

    const result = await verifyTurnstileToken("token")

    expect(result).toBe(false)
  })
})
