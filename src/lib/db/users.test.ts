import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getUsersByCompany,
  updateUser,
  updateUserRole,
  getAllUsers,
  updateUserAdmin,
  createUser,
  deleteUser,
} = await import("@/lib/db/users");

const companyId = "company-1";
const userId = "user-1";

const mockUser = {
  id: userId,
  name: "Test User",
  email: "test@user.com",
  role: "TECH",
  companyId,
  phone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUsersByCompany", () => {
  it("returns users scoped to a company", async () => {
    prismaMock.user.findMany.mockResolvedValue([mockUser]);

    const result = await getUsersByCompany(companyId);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    expect(result).toEqual([mockUser]);
  });
});

describe("updateUser", () => {
  it("updates a user within a company scope", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);

    const result = await updateUser(userId, companyId, { name: "Updated" });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, companyId },
      data: { name: "Updated" },
    });
    expect(result).toEqual(mockUser);
  });

  it("updates without company scope when companyId is null", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);

    await updateUser(userId, null, { name: "Updated" });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "Updated" },
    });
  });

  it("throws when user is not found", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateUser(userId, companyId, { name: "X" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("updateUserRole", () => {
  it("updates a user's role", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ ...mockUser, role: "OWNER" });

    await updateUserRole(userId, companyId, "OWNER" as never);

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, companyId },
      data: { role: "OWNER" },
    });
  });
});

describe("getAllUsers", () => {
  it("returns all users with company", async () => {
    prismaMock.user.findMany.mockResolvedValue([mockUser]);

    const result = await getAllUsers();

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      include: { company: true },
    });
    expect(result).toEqual([mockUser]);
  });
});

describe("updateUserAdmin", () => {
  it("updates user admin fields scoped to company", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);

    await updateUserAdmin(userId, companyId, {
      name: "Admin",
      role: "OWNER" as never,
      phone: "555-0100",
    });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, companyId },
      data: { name: "Admin", role: "OWNER", phone: "555-0100" },
    });
  });
});

describe("createUser", () => {
  it("creates a user", async () => {
    prismaMock.user.create.mockResolvedValue(mockUser);

    const result = await createUser({
      name: "Test User",
      email: "test@user.com",
      role: "TECH" as never,
      companyId,
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { name: "Test User", email: "test@user.com", role: "TECH", companyId },
    });
    expect(result).toEqual(mockUser);
  });
});

describe("deleteUser", () => {
  it("deletes a user scoped to a company", async () => {
    prismaMock.user.deleteMany.mockResolvedValue({ count: 1 });

    await deleteUser(userId, companyId);

    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: userId, companyId },
    });
  });

  it("deletes without company scope when companyId is null", async () => {
    prismaMock.user.deleteMany.mockResolvedValue({ count: 1 });

    await deleteUser(userId, null);

    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: userId },
    });
  });

  it("throws when user is not found", async () => {
    prismaMock.user.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteUser(userId, companyId)).rejects.toThrow(/not found/i);
  });
});
