import "server-only"

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export const TURNSTILE_ERROR_MESSAGE = "Please complete the verification challenge."

/**
 * Fails closed on any verification problem (missing token, non-2xx response,
 * network/parse error) once TURNSTILE_SECRET_KEY is configured — a Cloudflare
 * outage must not silently disable bot protection in production. Returns true
 * without calling out when the secret is unset, or when explicitly disabled via
 * NEXT_PUBLIC_TURNSTILE_ENABLED=false, so local dev works unconfigured.
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "false") return true

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true

  if (!token) return false

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    })
    if (!res.ok) return false

    const data = (await res.json()) as { success: boolean }
    return data.success === true
  } catch {
    return false
  }
}
