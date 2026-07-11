import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireOwner: vi.fn(),
}));
vi.mock("@/lib/db/company", () => ({
  updateCompany: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({
  updateUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireAuth, requireOwner } = await import("@/lib/auth");
const { updateCompany } = await import("@/lib/db/company");
const { updateUser } = await import("@/lib/db/users");
const { createClient } = await import("@/lib/supabase/server");
const { revalidatePath } = await import("next/cache");
const {
  updateAccountAction,
  updateCompanyAction,
  updatePasswordAction,
} = await import("./actions");

const mockUser = {
  id: "user-1",
  companyId: "company-1",
  email: "user@test.com",
  role: "TECH",
};

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateAccountAction", () => {
  it("updates the user's name and revalidates", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await updateAccountAction(
      { ok: false },
      formData({ name: "New Name" }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith("user-1", "company-1", {
      name: "New Name",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("returns error when name is empty", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await updateAccountAction(
      { ok: false },
      formData({ name: "" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Name is required.",
    });
  });
});

describe("updateCompanyAction", () => {
  it("updates company details when user is owner", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await updateCompanyAction(
      { ok: false },
      formData({ name: "Co", email: "co@test.com" }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateCompany).toHaveBeenCalledWith("company-1", {
      name: "Co",
      email: "co@test.com",
      phone: null,
      address: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("returns error when name is missing", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await updateCompanyAction(
      { ok: false },
      formData({ email: "co@test.com" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Company name is required.",
    });
  });

  it("returns error when user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await updateCompanyAction(
      { ok: false },
      formData({ name: "Co", email: "co@test.com" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "No company affiliation.",
    });
  });
});

describe("updatePasswordAction", () => {
  it("updates password after verifying current password", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
      },
    } as never);

    const result = await updatePasswordAction(
      { ok: false },
      formData({
        currentPassword: "old",
        newPassword: "newpass",
        confirmPassword: "newpass",
      }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("returns error when current password is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await updatePasswordAction(
      { ok: false },
      formData({
        currentPassword: "",
        newPassword: "newpass",
        confirmPassword: "newpass",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Current password is required.",
    });
  });

  it("returns error when new password is too short", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await updatePasswordAction(
      { ok: false },
      formData({
        currentPassword: "old",
        newPassword: "12345",
        confirmPassword: "12345",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "New password must be at least 6 characters.",
    });
  });

  it("returns error when passwords do not match", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await updatePasswordAction(
      { ok: false },
      formData({
        currentPassword: "old",
        newPassword: "newpass",
        confirmPassword: "mismatch",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "New passwords do not match.",
    });
  });

  it("returns error when current password is incorrect", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi
          .fn()
          .mockResolvedValue({ error: new Error("Invalid credentials") }),
      },
    } as never);

    const result = await updatePasswordAction(
      { ok: false },
      formData({
        currentPassword: "wrong",
        newPassword: "newpass",
        confirmPassword: "newpass",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Current password is incorrect.",
    });
  });
});
