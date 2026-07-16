import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    pool: { findUnique: vi.fn() },
  },
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
  it("returns the user directly when supabaseId matches", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "sb-1", email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      supabaseId: "sb-1",
    } as never);

    const result = await getCurrentUser();

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { supabaseId: "sb-1" },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({ ...mockUser, supabaseId: "sb-1" });
  });

  it("falls back to email and backfills a missing supabaseId", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "sb-2", email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null) // no row by supabaseId
      .mockResolvedValueOnce({ ...mockUser, supabaseId: null } as never); // legacy row by email
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...mockUser,
      supabaseId: "sb-2",
    } as never);

    const result = await getCurrentUser();

    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { email: "user@test.com" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { supabaseId: "sb-2" },
    });
    expect(result).toEqual({ ...mockUser, supabaseId: "sb-2" });
  });

  it("re-backfills when the stored supabaseId is stale", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "sb-new", email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null) // no row by the new supabaseId
      .mockResolvedValueOnce({ ...mockUser, supabaseId: "sb-old" } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...mockUser,
      supabaseId: "sb-new",
    } as never);

    const result = await getCurrentUser();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { supabaseId: "sb-new" },
    });
    expect(result).toEqual({ ...mockUser, supabaseId: "sb-new" });
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
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when there's no supabaseId match and no email to fall back on", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "sb-3", email: null } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns null when no DB row matches by supabaseId or email", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "sb-4", email: "unknown@test.com" } },
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

  it("redirects to /login when not authenticated", async () => {
    vi.mocked(createClient).mockImplementation(() =>
      Promise.resolve({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
          }),
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      } as never),
    );

    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT");
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

  it("succeeds when user has one of the allowed roles", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await requireRole(["TECH", "OWNER"]);
    expect(result.role).toBe("TECH");
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

  it("throws when user is not an OWNER", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    await expect(requireOwner()).rejects.toThrow(/requires one of these roles/i);
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

  it("throws when user is not TECH/OWNER/SUPER_ADMIN", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      role: "UNKNOWN_ROLE",
    } as never);

    await expect(requireTech()).rejects.toThrow(/requires one of these roles/i);
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

  it("throws when user is not a SUPER_ADMIN", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@test.com" } },
        }),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    await expect(requireSuperAdmin()).rejects.toThrow(/SUPER_ADMIN/i);
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

  it("returns null for SUPER_ADMIN (no company)", async () => {
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
      companyId: null,
    } as never);

    const result = await getCompanyId();
    expect(result).toBeNull();
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
