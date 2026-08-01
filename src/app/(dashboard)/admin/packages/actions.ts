"use server"

import { revalidatePath } from "next/cache"

import { requireSuperAdmin } from "@/lib/auth"
import {
  createPackage,
  updatePackage,
  deletePackage,
  countCompaniesOnPackage,
} from "@/lib/db/packages"
import { updateTrialDays } from "@/lib/db/platform-settings"
import { updatePaymentSettings } from "@/lib/db/payment-settings"
import type { PackageFeatures } from "@/lib/package-features"
import { logger } from "@/lib/log"

function parsePackageFeaturesFromForm(formData: FormData): PackageFeatures {
  return {
    max_pools: parseInt(formData.get("features.max_pools") as string, 10) || 5,
    health_scoring: (formData.get("features.health_scoring") as string) || "basic",
    chemical_recs: formData.get("features.chemical_recs") === "on",
    service_reports: formData.get("features.service_reports") === "on",
    qr_code: formData.get("features.qr_code") === "on",
    scheduling: formData.get("features.scheduling") === "on",
    max_techs: parseInt(formData.get("features.max_techs") as string, 10) || 1,
    priority_support: formData.get("features.priority_support") === "on",
    custom_branding: formData.get("features.custom_branding") === "on",
    api_access: formData.get("features.api_access") === "on",
    csv_import: formData.get("features.csv_import") === "on",
  } as PackageFeatures
}

export async function createPackageAction(formData: FormData) {
  const currentUser = await requireSuperAdmin()

  const slug = (formData.get("slug") as string)?.trim().toLowerCase()
  const name = (formData.get("name") as string)?.trim()
  const price = parseInt(formData.get("price") as string, 10) || 0
  const features = parsePackageFeaturesFromForm(formData)

  const pkg = await createPackage({
    slug,
    name,
    price: Math.round(price * 100),
    features: JSON.stringify(features),
  })
  logger.info("Package created", {
    context: "admin.packages.createPackageAction",
    userId: currentUser.id,
    metadata: { packageId: pkg.id, slug, name, price: pkg.price },
  })
  revalidatePath("/admin/packages")
}

export async function updatePackageAction(formData: FormData) {
  const currentUser = await requireSuperAdmin()

  const id = formData.get("id") as string
  if (!id) throw new Error("Package ID is required.")

  const name = (formData.get("name") as string)?.trim()
  const price = parseInt(formData.get("price") as string, 10) || 0
  const features = parsePackageFeaturesFromForm(formData)

  await updatePackage(id, {
    name,
    price: Math.round(price * 100),
    features: JSON.stringify(features),
  })
  logger.info("Package updated", {
    context: "admin.packages.updatePackageAction",
    userId: currentUser.id,
    metadata: { packageId: id, name, price: Math.round(price * 100) },
  })
  revalidatePath("/admin/packages")
}

export async function deletePackageAction(formData: FormData) {
  const currentUser = await requireSuperAdmin()

  const id = formData.get("id") as string
  if (!id) throw new Error("Package ID is required.")

  const dependents = await countCompaniesOnPackage(id)
  if (dependents > 0) {
    throw new Error(
      `Can't delete this plan — ${dependents} compan${dependents === 1 ? "y is" : "ies are"} currently on it.`,
    )
  }

  await deletePackage(id)
  logger.info("Package deleted", {
    context: "admin.packages.deletePackageAction",
    userId: currentUser.id,
    metadata: { packageId: id },
  })
  revalidatePath("/admin/packages")
}

export async function updateTrialDaysAction(formData: FormData) {
  const currentUser = await requireSuperAdmin()

  const days = parseInt(formData.get("trialDays") as string, 10)
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("Trial length must be a positive number of days.")
  }

  await updateTrialDays(days)
  logger.info("Platform trial length updated", {
    context: "admin.packages.updateTrialDaysAction",
    userId: currentUser.id,
    metadata: { trialDays: days },
  })
  revalidatePath("/admin/packages")
}

export async function updatePaymentSettingsAction(formData: FormData) {
  const currentUser = await requireSuperAdmin()

  const stripeEnabled = formData.get("stripeEnabled") === "on"
  const paypalEnabled = formData.get("paypalEnabled") === "on"
  const paymentDevMode = formData.get("paymentDevMode") !== "live"

  await updatePaymentSettings({
    stripeEnabled,
    paypalEnabled,
    paymentDevMode,
  })

  logger.info("Payment settings updated", {
    context: "admin.packages.updatePaymentSettingsAction",
    userId: currentUser.id,
    metadata: { stripeEnabled, paypalEnabled, paymentDevMode },
  })
  revalidatePath("/admin/packages")
}
