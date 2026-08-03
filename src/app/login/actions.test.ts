import { describe, expect, it, beforeEach, vi } from "vitest"

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
  TURNSTILE_ERROR_MESSAGE: "Please complete the verification challenge.",
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}))
vi.mock("@/lib/email/notify", () => ({
  notifyPasswordReset: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

const { verifyTurnstileToken } = await import("@/lib/turnstile")
const { createClient } = await import("@/lib/supabase/server")
const { createAdminClient } = await import("@/lib/supabase/admin")
const { notifyPasswordReset } = await import("@/lib/email/notify")
const { redirect } = await import("next/navigation")
const { revalidatePath } = await import("next/cache")
const { loginAction, requestPasswordResetAction, resendConfirmationAction } =
  await import("./actions")

function loginFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set("email", "jane@example.com")
  formData.set("password", "password123")
  formData.set("cf-turnstile-response", "token")
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value)
  }
  return formData
}

function resetFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set("email", "jane@example.com")
  formData.set("cf-turnstile-response", "token")
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value)
  }
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("loginAction", () => {
  it("rejects with the turnstile error and never calls signInWithPassword when verification fails", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)

    const result = await loginAction({ ok: false }, loginFormData())

    expect(result).toEqual({
      ok: false,
      error: "Please complete the verification challenge.",
    })
    expect(createClient).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("signs in and redirects to the dashboard when verification succeeds", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { email_confirmed_at: "2024-01-01T00:00:00Z" } },
          error: null,
        }),
        signOut: vi.fn(),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    await loginAction({ ok: false }, loginFormData())

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "password123",
    })
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })

  it("blocks sign-in and signs the user back out when the email isn't confirmed", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { email_confirmed_at: null } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const result = await loginAction({ ok: false }, loginFormData())

    expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      error:
        "Please confirm your email before signing in. Check your inbox for the confirmation link.",
      unconfirmed: true,
      email: "jane@example.com",
    })
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe("resendConfirmationAction", () => {
  it("rejects with the turnstile error and never calls resend when verification fails", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)

    const result = await resendConfirmationAction({ ok: false }, resetFormData())

    expect(result).toEqual({
      ok: false,
      error: "Please complete the verification challenge.",
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("resends the confirmation email when verification succeeds", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    const mockSupabase = {
      auth: {
        resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const result = await resendConfirmationAction({ ok: false }, resetFormData())

    expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "jane@example.com",
      options: {
        emailRedirectTo: "https://localhost:3000/auth/confirm?next=%2Fonboarding",
      },
    })
    expect(result).toEqual({ ok: true, sent: true })
  })
})

describe("requestPasswordResetAction", () => {
  it("rejects with the turnstile error and never calls generateLink when verification fails", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)

    const result = await requestPasswordResetAction({ ok: false }, resetFormData())

    expect(result).toEqual({
      ok: false,
      error: "Please complete the verification challenge.",
    })
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(notifyPasswordReset).not.toHaveBeenCalled()
  })

  it("sends the reset link when verification succeeds", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    const mockAdmin = {
      auth: {
        admin: {
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: { hashed_token: "abc123" } },
            error: null,
          }),
        },
      },
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)
    vi.mocked(notifyPasswordReset).mockResolvedValue(undefined as never)

    const result = await requestPasswordResetAction({ ok: false }, resetFormData())

    expect(result).toEqual({ ok: true, sent: true })
    expect(notifyPasswordReset).toHaveBeenCalledWith({
      to: "jane@example.com",
      resetUrl: "https://localhost:3000/auth/update-password?token_hash=abc123&type=recovery",
    })
  })
})
