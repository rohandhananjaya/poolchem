import { describe, expect, it, beforeEach, vi } from "vitest"

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
  TURNSTILE_ERROR_MESSAGE: "Please complete the verification challenge.",
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}))
vi.mock("@/lib/db/company", () => ({
  createCompany: vi.fn(),
}))
vi.mock("@/lib/db/users", () => ({
  createUser: vi.fn(),
}))
vi.mock("@/lib/db/packages", () => ({
  startTrial: vi.fn(),
}))
vi.mock("@/lib/email/notify", () => ({
  notifyConfirmSignup: vi.fn(),
}))

const { verifyTurnstileToken } = await import("@/lib/turnstile")
const { prisma } = await import("@/lib/prisma")
const { createAdminClient } = await import("@/lib/supabase/admin")
const { createCompany } = await import("@/lib/db/company")
const { createUser } = await import("@/lib/db/users")
const { startTrial } = await import("@/lib/db/packages")
const { notifyConfirmSignup } = await import("@/lib/email/notify")
const { signupAction } = await import("./actions")

function buildFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set("companyName", "ClearBlue Pools")
  formData.set("name", "Jane Smith")
  formData.set("email", "jane@example.com")
  formData.set("password", "password123")
  formData.set("cf-turnstile-response", "token")
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value)
  }
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("signupAction", () => {
  it("rejects with the turnstile error and never touches the DB when verification fails", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)

    const result = await signupAction({ ok: false }, buildFormData())

    expect(result).toEqual({
      ok: false,
      error: "Please complete the verification challenge.",
    })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(createCompany).not.toHaveBeenCalled()
  })

  it("proceeds through the full happy path when verification succeeds", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const mockAdmin = {
      auth: {
        admin: {
          generateLink: vi.fn().mockResolvedValue({
            data: {
              user: { id: "supabase-1" },
              properties: { hashed_token: "abc123" },
            },
            error: null,
          }),
        },
      },
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)
    vi.mocked(createCompany).mockResolvedValue({ id: "company-1" } as never)
    vi.mocked(createUser).mockResolvedValue({ id: "user-1" } as never)
    vi.mocked(startTrial).mockResolvedValue(undefined as never)
    vi.mocked(notifyConfirmSignup).mockResolvedValue(undefined as never)

    const result = await signupAction({ ok: false }, buildFormData())

    expect(result).toEqual({ ok: true })
    expect(mockAdmin.auth.admin.generateLink).toHaveBeenCalledWith({
      type: "signup",
      email: "jane@example.com",
      password: "password123",
      options: { redirectTo: "https://localhost:3000/auth/confirm" },
    })
    expect(createCompany).toHaveBeenCalledWith({
      name: "ClearBlue Pools",
      email: "jane@example.com",
    })
    expect(createUser).toHaveBeenCalledWith({
      name: "Jane Smith",
      email: "jane@example.com",
      role: "OWNER",
      companyId: "company-1",
      supabaseId: "supabase-1",
    })
    expect(startTrial).toHaveBeenCalledWith("company-1")
    expect(notifyConfirmSignup).toHaveBeenCalledWith({
      to: "jane@example.com",
      name: "Jane Smith",
      confirmUrl:
        "https://localhost:3000/auth/confirm?token_hash=abc123&type=signup&next=%2Fonboarding",
    })
  })
})
