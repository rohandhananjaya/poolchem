import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
}));
vi.mock("@/lib/db/properties", () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  getPropertyById: vi.fn(),
  setPoolProperty: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireOwner } = await import("@/lib/auth");
const {
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyById,
  setPoolProperty,
} = await import("@/lib/db/properties");
const { revalidatePath } = await import("next/cache");
const {
  createPropertyAction,
  updatePropertyAction,
  deletePropertyAction,
  setPoolPropertyAction,
} = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "OWNER" };

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

describe("createPropertyAction", () => {
  it("creates a property and returns ok", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await createPropertyAction(
      { ok: false },
      formData({ name: "Oceanview", address: "123 Beach Rd", notes: "Gate code 1234" }),
    );

    expect(result).toEqual({ ok: true });
    expect(createProperty).toHaveBeenCalledWith(
      {
        name: "Oceanview",
        address: "123 Beach Rd",
        notes: "Gate code 1234",
      },
      "company-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
  });

  it("returns error when name is empty", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await createPropertyAction(
      { ok: false },
      formData({ name: "", address: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Property name is required." });
    expect(createProperty).not.toHaveBeenCalled();
  });

  it("returns error when user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await createPropertyAction(
      { ok: false },
      formData({ name: "Oceanview" }),
    );

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
    expect(createProperty).not.toHaveBeenCalled();
  });
});

describe("updatePropertyAction", () => {
  it("updates a property and returns ok", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await updatePropertyAction(
      { ok: false },
      formData({ propertyId: "property-1", name: "Updated", address: "", notes: "new" }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateProperty).toHaveBeenCalledWith(
      "property-1",
      { name: "Updated", address: null, notes: "new" },
      "company-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
  });

  it("returns error when propertyId is missing", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await updatePropertyAction(
      { ok: false },
      formData({ name: "Updated" }),
    );

    expect(result).toEqual({ ok: false, error: "Property ID is required." });
    expect(updateProperty).not.toHaveBeenCalled();
  });

  it("returns error when name is empty", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await updatePropertyAction(
      { ok: false },
      formData({ propertyId: "property-1", name: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Property name is required." });
    expect(updateProperty).not.toHaveBeenCalled();
  });
});

describe("deletePropertyAction", () => {
  it("deletes a property after confirming the name", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getPropertyById).mockResolvedValue({
      id: "property-1",
      name: "Oceanview",
    } as never);

    const result = await deletePropertyAction(
      { ok: false },
      formData({ propertyId: "property-1", confirmName: "Oceanview" }),
    );

    expect(result).toEqual({ ok: true });
    expect(deleteProperty).toHaveBeenCalledWith("property-1", "company-1");
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
    expect(revalidatePath).toHaveBeenCalledWith("/pools");
  });

  it("returns error when name does not match", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getPropertyById).mockResolvedValue({
      id: "property-1",
      name: "Oceanview",
    } as never);

    const result = await deletePropertyAction(
      { ok: false },
      formData({ propertyId: "property-1", confirmName: "Wrong Name" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Property name does not match.",
    });
    expect(deleteProperty).not.toHaveBeenCalled();
  });

  it("returns error when property not found", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getPropertyById).mockResolvedValue(null);

    const result = await deletePropertyAction(
      { ok: false },
      formData({ propertyId: "missing", confirmName: "x" }),
    );

    expect(result).toEqual({ ok: false, error: "Property not found." });
    expect(deleteProperty).not.toHaveBeenCalled();
  });
});

describe("setPoolPropertyAction", () => {
  it("attaches a pool to a property", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await setPoolPropertyAction("pool-1", "property-1");

    expect(result).toEqual({ ok: true });
    expect(setPoolProperty).toHaveBeenCalledWith(
      "pool-1",
      "property-1",
      "company-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
    expect(revalidatePath).toHaveBeenCalledWith("/pools");
  });

  it("detaches a pool when propertyId is null", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await setPoolPropertyAction("pool-1", null);

    expect(result).toEqual({ ok: true });
    expect(setPoolProperty).toHaveBeenCalledWith("pool-1", null, "company-1");
  });

  it("returns error when the db helper throws (cross-tenant guard)", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(setPoolProperty).mockRejectedValue(new Error("cross-tenant"));

    const result = await setPoolPropertyAction("pool-1", "property-1");

    expect(result).toEqual({
      ok: false,
      error: "Could not attach pool. Please try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns error when user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await setPoolPropertyAction("pool-1", "property-1");

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
    expect(setPoolProperty).not.toHaveBeenCalled();
  });

  it("returns error when poolId is missing", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await setPoolPropertyAction("", "property-1");

    expect(result).toEqual({ ok: false, error: "Pool ID is required." });
    expect(setPoolProperty).not.toHaveBeenCalled();
  });
});
