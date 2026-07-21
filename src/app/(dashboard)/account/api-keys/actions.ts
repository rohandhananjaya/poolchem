"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/auth"
import { createApiKey, revokeApiKey, type ApiKeySummary } from "@/lib/db/api-keys"
import { getCompanyPackage } from "@/lib/db/packages"
import { checkFeatureAccess } from "@/lib/package-features"
import { audit } from "@/lib/audit"

const MAX_NAME_LENGTH = 60

export interface CreateApiKeyResult {
  ok: boolean
  error?: string
  key?: ApiKeySummary
  plaintextSecret?: string
}

/**
 * Generates a new API key for the caller's company. Re-checks `api_access`
 * server-side (never trusts a client-computed `canUseApiKeys` prop), matching
 * the pattern used by `updateCompanyAction`/`importPoolsAction`.
 */
export async function createApiKeyAction(name: string): Promise<CreateApiKeyResult> {
  const user = await requireOwner()
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." }
  }

  const trimmedName = name.trim()
  if (trimmedName === "") {
    return { ok: false, error: "A name is required to tell keys apart." }
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }
  }

  const companyPackage = await getCompanyPackage(user.companyId)
  if (!companyPackage || !checkFeatureAccess(companyPackage, "api_access")) {
    return { ok: false, error: "API access is not available on your plan." }
  }

  try {
    const { key, plaintextSecret } = await createApiKey(user.companyId, trimmedName)
    await audit.log(user.companyId, user.id, "api_key.created", { keyId: key.id, name: trimmedName })
    revalidatePath("/account/api-keys")
    return { ok: true, key, plaintextSecret }
  } catch {
    return { ok: false, error: "Could not create the API key. Please try again." }
  }
}

export interface RevokeApiKeyResult {
  ok: boolean
  error?: string
}

/** Revokes an API key belonging to the caller's company. */
export async function revokeApiKeyAction(keyId: string): Promise<RevokeApiKeyResult> {
  const user = await requireOwner()
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." }
  }

  try {
    await revokeApiKey(keyId, user.companyId)
    await audit.log(user.companyId, user.id, "api_key.revoked", { keyId })
    revalidatePath("/account/api-keys")
    return { ok: true }
  } catch {
    return { ok: false, error: "Could not revoke the API key. Please try again." }
  }
}
