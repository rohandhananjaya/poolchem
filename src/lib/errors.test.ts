import { describe, expect, it } from "vitest";

import {
  AppError,
  AuthError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  isAppError,
  toUserMessage,
} from "./errors";

describe("AppError", () => {
  it("sets default code and status", () => {
    const error = new AppError("Test");
    expect(error.code).toBe("APP");
    expect(error.status).toBe(500);
    expect(error.message).toBe("Test");
  });

  it("accepts custom options", () => {
    const error = new AppError("Custom", {
      code: "VALIDATION",
      status: 400,
    });
    expect(error.code).toBe("VALIDATION");
    expect(error.status).toBe(400);
  });
});

describe("AuthError", () => {
  it("sets code=AUTH and status=401", () => {
    const error = new AuthError();
    expect(error.code).toBe("AUTH");
    expect(error.status).toBe(401);
    expect(error.message).toContain("sign in");
  });
});

describe("UnauthorizedError", () => {
  it("sets code=UNAUTHORIZED and status=403", () => {
    const error = new UnauthorizedError();
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.status).toBe(403);
    expect(error.message).toContain("permission");
  });
});

describe("NotFoundError", () => {
  it("sets code=NOT_FOUND and status=404", () => {
    const error = new NotFoundError();
    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toContain("couldn't find");
  });
});

describe("ValidationError", () => {
  it("sets code=VALIDATION and status=400", () => {
    const error = new ValidationError();
    expect(error.code).toBe("VALIDATION");
    expect(error.status).toBe(400);
    expect(error.message).toContain("valid");
  });
});

describe("isAppError", () => {
  it("returns true for AppError instances", () => {
    expect(isAppError(new AppError("x"))).toBe(true);
    expect(isAppError(new AuthError())).toBe(true);
  });

  it("returns false for regular Errors", () => {
    expect(isAppError(new Error("x"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

describe("toUserMessage", () => {
  it("returns AppError message verbatim", () => {
    const error = new AuthError("Custom message");
    expect(toUserMessage(error)).toBe("Custom message");
  });

  it("returns generic message for non-AppError", () => {
    expect(toUserMessage(new Error("raw"))).toContain("went wrong");
    expect(toUserMessage("string")).toContain("went wrong");
    expect(toUserMessage(null)).toContain("went wrong");
  });
});
