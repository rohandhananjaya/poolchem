/**
 * Application error types.
 *
 * These are intentionally isomorphic (no `server-only` guard) so they can be
 * thrown from `db/` helpers and Server Actions and still have their `code` /
 * `message` read on the client. Keep this file free of I/O and Prisma imports.
 */

/** User-facing copy, kept in one place so wording stays consistent. */
export const ERROR_MESSAGES = {
  UNAUTHENTICATED: "You need to sign in to continue.",
  UNAUTHORIZED: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  VALIDATION: "Some of the information provided isn't valid.",
  RATE_LIMITED: "Too many requests. Please slow down and try again shortly.",
  GENERIC: "Something went wrong. Please try again.",
  SAVE_FAILED: "Failed to save. Please try again.",
  NETWORK: "We couldn't reach the server. Check your connection and try again.",
  VERSION_CONFLICT:
    "This visit was updated on another device. Refresh and re-apply your changes.",
} as const

export type ErrorCode =
  | "AUTH"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "APP"

export interface AppErrorOptions {
  /** Machine-readable code, useful for branching / logging. */
  code?: ErrorCode
  /** Suggested HTTP-style status, handy if this ever maps to a response. */
  status?: number
  /** Original error, preserved for stack traces. */
  cause?: unknown
}

/**
 * Base class for all expected, well-typed application errors. Anything thrown
 * as an `AppError` carries a friendly `message` that is safe to show a user.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(
    message: string = ERROR_MESSAGES.GENERIC,
    { code = "APP", status = 500, cause }: AppErrorOptions = {},
  ) {
    super(message, { cause })
    this.name = new.target.name
    this.code = code
    this.status = status
    // Restore prototype chain when compiled down to ES5-ish targets.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** The user isn't signed in (no valid session). */
export class AuthError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.UNAUTHENTICATED,
    options: Omit<AppErrorOptions, "code" | "status"> = {},
  ) {
    super(message, { ...options, code: "AUTH", status: 401 })
  }
}

/** The user is signed in but lacks permission (e.g. wrong tenant / role). */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.UNAUTHORIZED,
    options: Omit<AppErrorOptions, "code" | "status"> = {},
  ) {
    super(message, { ...options, code: "UNAUTHORIZED", status: 403 })
  }
}

/** A requested record doesn't exist (or is out of the caller's tenant scope). */
export class NotFoundError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.NOT_FOUND,
    options: Omit<AppErrorOptions, "code" | "status"> = {},
  ) {
    super(message, { ...options, code: "NOT_FOUND", status: 404 })
  }
}

/** Input failed validation before it could be persisted. */
export class ValidationError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.VALIDATION,
    options: Omit<AppErrorOptions, "code" | "status"> = {},
  ) {
    super(message, { ...options, code: "VALIDATION", status: 400 })
  }
}

/** A caller (e.g. an API key) exceeded its allotted request rate. */
export class RateLimitError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.RATE_LIMITED,
    options: Omit<AppErrorOptions, "code" | "status"> = {},
  ) {
    super(message, { ...options, code: "RATE_LIMITED", status: 429 })
  }
}

/**
 * A terminal write was attempted against a stale revision of a visit. The
 * visit was updated on another device after this client's known `version`, so
 * applying the write would clobber newer state. Client matches on this message
 * to show a "refresh and re-apply" recovery toast.
 */
export class VisitVersionConflictError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.VERSION_CONFLICT,
    options: Omit<AppErrorOptions, "code" | "status"> = {},
  ) {
    super(message, { ...options, code: "CONFLICT", status: 409 })
  }
}

/** Type guard for narrowing unknown thrown values to an {@link AppError}. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Extract a user-safe message from an unknown thrown value. `AppError`
 * messages are trusted; everything else falls back to the generic copy so we
 * never surface a raw stack trace or internal detail to the user.
 */
export function toUserMessage(error: unknown): string {
  if (isAppError(error)) return error.message
  return ERROR_MESSAGES.GENERIC
}
