import "server-only";

import { Resend } from "resend";

import { logger } from "@/lib/log";

/* -------------------------------------------------------------------------- */
/* Rate limiter                                                               */
/* -------------------------------------------------------------------------- */

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX) return false;
  bucket.count++;
  return true;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your environment variables.",
    );
  }
  return new Resend(apiKey);
}

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Sends a transactional email via Resend with rate limiting.
 * Returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!checkRateLimit("global")) {
    return { ok: false, error: "Rate limit exceeded. Please try again later." };
  }

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      logger.error("Email send failed", {
        context: "email.sendEmail",
        metadata: { to: input.to, subject: input.subject, error: error.message },
      });
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Email send threw", {
      context: "email.sendEmail",
      metadata: { to: input.to, subject: input.subject, error: message },
    });
    return { ok: false, error: message };
  }
}
