"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createCompany, deleteCompany, getCompanyById, updateCompany } from "@/lib/db/company";

export interface FormState {
  ok: boolean;
  error?: string;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const companyId = text(formData, "companyId");
  if (!companyId) {
    return { ok: false, error: "Company ID is required." };
  }

  const name = text(formData, "name");
  const email = text(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  const subscriptionStatus = optionalText(formData, "subscriptionStatus");
  const active = formData.get("active") === "on";

  try {
    await updateCompany(companyId, {
      name,
      email,
      phone: optionalText(formData, "phone"),
      address: optionalText(formData, "address"),
      subscriptionStatus,
      active,
    });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update company. Please try again." };
  }
}

export async function createCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const name = text(formData, "name");
  const email = text(formData, "email");
  if (name === "") return { ok: false, error: "Company name is required." };
  if (email === "") return { ok: false, error: "Company email is required." };

  try {
    await createCompany({
      name,
      email,
      phone: optionalText(formData, "phone"),
      address: optionalText(formData, "address"),
    });
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create company. Please try again." };
  }
}

export async function deleteCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const companyId = text(formData, "companyId");
  if (!companyId) {
    return { ok: false, error: "Company ID is required." };
  }

  const confirmName = text(formData, "confirmName");

  const company = await getCompanyById(companyId);
  if (!company) {
    return { ok: false, error: "Company not found." };
  }

  if (confirmName !== company.name) {
    return { ok: false, error: "Company name does not match." };
  }

  try {
    await deleteCompany(companyId);
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete company. Please try again." };
  }
}
