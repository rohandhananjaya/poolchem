"use server"

import { revalidatePath } from "next/cache"

import { requireSuperAdmin } from "@/lib/auth"
import {
  createPackage,
  updatePackage,
  deletePackage,
  adminSetPackage,
} from "@/lib/db/packages"

export async function createPackageAction(formData: FormData) {
  await requireSuperAdmin()

  const slug = (formData.get("slug") as string)?.trim().toLowerCase()
  const name = (formData.get("name") as string)?.trim()
  const price = parseInt(formData.get("price") as string, 10) || 0
  const trialDays = parseInt(formData.get("trialDays") as string, 10) || 14
  const sortOrder = parseInt(formData.get("sortOrder") as string, 10) || 0

  const features = {
    max_pools: parseInt(formData.get("features.max_pools") as string, 10) || 5,
    health_scoring: (formData.get("features.health_scoring") as string) || "basic",
    chemical_recs: formData.get("features.chemical_recs") === "on",
    service_reports: formData.get("features.service_reports") === "on",
    qr_code: formData.get("features.qr_code") === "on",
    scheduling: formData.get("features.scheduling") === "on",
    multi_tech: formData.get("features.multi_tech") === "on",
    priority_support: formData.get("features.priority_support") === "on",
    custom_branding: formData.get("features.custom_branding") === "on",
    api_access: formData.get("features.api_access") === "on",
    csv_import: formData.get("features.csv_import") === "on",
  }

  await createPackage({ slug, name, price: Math.round(price * 100), features: JSON.stringify(features), trialDays, sortOrder })
  revalidatePath("/admin/packages")
}

export async function updatePackageAction(formData: FormData) {
  await requireSuperAdmin()

  const id = formData.get("id") as string
  if (!id) throw new Error("Package ID is required.")

  const name = (formData.get("name") as string)?.trim()
  const price = parseInt(formData.get("price") as string, 10) || 0
  const trialDays = parseInt(formData.get("trialDays") as string, 10) || 14
  const sortOrder = parseInt(formData.get("sortOrder") as string, 10) || 0

  const features = {
    max_pools: parseInt(formData.get("features.max_pools") as string, 10) || 5,
    health_scoring: (formData.get("features.health_scoring") as string) || "basic",
    chemical_recs: formData.get("features.chemical_recs") === "on",
    service_reports: formData.get("features.service_reports") === "on",
    qr_code: formData.get("features.qr_code") === "on",
    scheduling: formData.get("features.scheduling") === "on",
    multi_tech: formData.get("features.multi_tech") === "on",
    priority_support: formData.get("features.priority_support") === "on",
    custom_branding: formData.get("features.custom_branding") === "on",
    api_access: formData.get("features.api_access") === "on",
    csv_import: formData.get("features.csv_import") === "on",
  }

  await updatePackage(id, { name, price: Math.round(price * 100), features: JSON.stringify(features), trialDays, sortOrder })
  revalidatePath("/admin/packages")
}

export async function deletePackageAction(formData: FormData) {
  await requireSuperAdmin()

  const id = formData.get("id") as string
  if (!id) throw new Error("Package ID is required.")

  await deletePackage(id)
  revalidatePath("/admin/packages")
}

export async function adminSetCompanyPackageAction(formData: FormData) {
  await requireSuperAdmin()

  const companyId = formData.get("companyId") as string
  const packageId = formData.get("packageId") as string
  const status = formData.get("status") as "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED"
  const trialDays = parseInt(formData.get("trialDays") as string, 10) || undefined

  if (!companyId || !packageId || !status) {
    throw new Error("Missing required fields.")
  }

  await adminSetPackage(companyId, packageId, status, trialDays)
  revalidatePath("/admin/packages")
}
