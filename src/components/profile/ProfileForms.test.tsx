import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/(dashboard)/settings/actions", () => ({
  updateAccountAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  updatePasswordAction: vi.fn(),
  deleteAccountAction: vi.fn(),
  exportDataAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/storage/logo-validation", () => ({
  validateLogoFile: vi.fn(),
}));

import { ProfileForms } from "./ProfileForms";
import { validateLogoFile } from "@/lib/storage/logo-validation";

const account = { name: "Jane Tech", email: "jane@test.com", role: "TECH" };

function companyWithLogo(logo: string | null) {
  return {
    name: "Acme Pools",
    email: "acme@test.com",
    phone: null,
    address: null,
    logo,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileForms — company logo", () => {
  it("renders the upgrade dialog instead of the uploader when custom_branding is unavailable", () => {
    render(
      <ProfileForms
        account={account}
        company={companyWithLogo(null)}
        canEditCompany
        canEditBranding={false}
      />,
    );

    expect(screen.queryByTestId("logo-file-input")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logo" })).toBeInTheDocument();
  });

  it("shows the existing logo and lets it be removed", async () => {
    const user = userEvent.setup();
    render(
      <ProfileForms
        account={account}
        company={companyWithLogo("https://example.com/logo.png")}
        canEditCompany
        canEditBranding
      />,
    );

    expect(screen.getByTestId("logo-preview")).toHaveAttribute(
      "src",
      "https://example.com/logo.png",
    );

    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(screen.getByTestId("logo-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("logo-preview")).not.toBeInTheDocument();
  });

  it("shows a placeholder when no logo is set", () => {
    render(
      <ProfileForms
        account={account}
        company={companyWithLogo(null)}
        canEditCompany
        canEditBranding
      />,
    );

    expect(screen.getByTestId("logo-placeholder")).toBeInTheDocument();
  });

  it("previews a newly selected valid logo file", async () => {
    vi.mocked(validateLogoFile).mockReturnValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ProfileForms
        account={account}
        company={companyWithLogo(null)}
        canEditCompany
        canEditBranding
      />,
    );

    const file = new File(["x"], "logo.png", { type: "image/png" });
    await user.upload(screen.getByTestId("logo-file-input"), file);

    expect(screen.getByTestId("logo-preview")).toBeInTheDocument();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast and skips the preview for an invalid file", async () => {
    vi.mocked(validateLogoFile).mockReturnValue({
      ok: false,
      error: "Logo must be 2MB or smaller.",
    });
    const user = userEvent.setup();
    render(
      <ProfileForms
        account={account}
        company={companyWithLogo(null)}
        canEditCompany
        canEditBranding
      />,
    );

    const file = new File(["x"], "logo.png", { type: "image/png" });
    await user.upload(screen.getByTestId("logo-file-input"), file);

    expect(mockToast.error).toHaveBeenCalledWith("Logo must be 2MB or smaller.");
    expect(screen.getByTestId("logo-placeholder")).toBeInTheDocument();
  });
});
