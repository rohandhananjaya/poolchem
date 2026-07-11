import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, pool: { findUnique: vi.fn() } },
}));

const { createClient } = await import("@/lib/supabase/server");
const { prisma } = await import("@/lib/prisma");
const {
  getCurrentUser,
  requireAuth,
  requireRole,
  requireOwner,
  requireTech,
  requireSuperAdmin,
  requireCompanyAccess,
  getCompanyId,
  validatePoolToken,
} = await import("./auth");

const mockUser = {
  id: "user-1",
  email: "user@test.com",
  name: "Test User",
  role: "TECH",
  companyId: "company-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("returns user when session email matches a DB row", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await getCurrentUser();

    expect(result).toEqual(mockUser);
  });

  it("returns null when there's no session", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    } as never);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns null when email is missing from session", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: null } },
        }),
      },
    } as never);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns null when no DB row for the email", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "unknown@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });
});

describe("requireAuth", () => {
  it("returns user when authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await requireAuth();

    expect(result).toEqual(mockUser);
  });

  it("throws AuthError when not authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    } as never);

    await expect(requireAuth()).rejects.toThrow(/sign in/);
  });
});

describe("requireRole", () => {
  it("throws when user does not have the required role", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    await expect(
      requireRole(["OWNER"]),
    ).rejects.toThrow(/requires one of these roles/i);
  });
});

describe("requireOwner", () => {
  it("succeeds for OWNER role", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "owner@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      role: "OWNER",
    } as never);

    const result = await requireOwner();
    expect(result.role).toBe("OWNER");
  });
});

describe("requireTech", () => {
  it("succeeds for TECH, OWNER, and SUPER_ADMIN roles", async () => {
    const roles = ["TECH", "OWNER", "SUPER_ADMIN"];
    for (const role of roles) {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { email: `user@test.com` } },
          }),
        },
      } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role,
      } as never);

      const result = await requireTech();
      expect(result.role).toBe(role);
      vi.clearAllMocks();
    }
  });
});

describe("requireSuperAdmin", () => {
  it("succeeds for SUPER_ADMIN role", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      role: "SUPER_ADMIN",
    } as never);

    const result = await requireSuperAdmin();
    expect(result.role).toBe("SUPER_ADMIN");
  });
});

describe("requireCompanyAccess", () => {
  it("succeeds when user belongs to the company", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await requireCompanyAccess("company-1");
    expect(result).toEqual(mockUser);
  });

  it("allows SUPER_ADMIN to access any company", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      role: "SUPER_ADMIN",
    } as never);

    const result = await requireCompanyAccess("other-company");
    expect(result).toBeDefined();
  });

  it("throws when user does not belong to the company", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    await expect(
      requireCompanyAccess("other-company"),
    ).rejects.toThrow(/don't have access/i);
  });
});

describe("getCompanyId", () => {
  it("returns the user's company id", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await getCompanyId();
    expect(result).toBe("company-1");
  });
});

describe("validatePoolToken", () => {
  it("returns pool and company for a valid token", async () => {
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({
      id: "pool-1",
      company: { name: "Test Co" },
    } as never);

    const result = await validatePoolToken("valid-token");
    expect(result).toBeDefined();
    expect(prisma.pool.findUnique).toHaveBeenCalledWith({
      where: { publicToken: "valid-token" },
      include: { company: true },
    });
  });

  it("returns null for an invalid token", async () => {
    vi.mocked(prisma.pool.findUnique).mockResolvedValue(null);

    const result = await validatePoolToken("invalid");
    expect(result).toBeNull();
  });
});
