import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthorized } from "@/lib/auth";

beforeEach(() => {
  vi.stubEnv("TEACHER_USERNAME", "teacher");
  vi.stubEnv("TEACHER_PASSWORD", "s3cret");
  vi.stubEnv("SESSION_SECRET", "a-very-long-test-secret-value-12345");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAuthorized", () => {
  it("accepts matching credentials", () => {
    expect(isAuthorized("teacher", "s3cret")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(isAuthorized("teacher", "nope")).toBe(false);
  });

  it("rejects a wrong username", () => {
    expect(isAuthorized("admin", "s3cret")).toBe(false);
  });

  it("returns false when env vars are missing", () => {
    vi.stubEnv("TEACHER_USERNAME", "");
    vi.stubEnv("TEACHER_PASSWORD", "");
    expect(isAuthorized("teacher", "s3cret")).toBe(false);
  });
});

async function loadSessionOptions() {
  vi.resetModules();
  const fresh = await import("@/lib/auth");
  return fresh.sessionOptions;
}

describe("sessionOptions", () => {
  it("configures an http-only lax cookie", async () => {
    const opts = await loadSessionOptions();
    expect(opts.cookieName).toBe("quizforge_session");
    expect(opts.cookieOptions?.httpOnly).toBe(true);
    expect(opts.cookieOptions?.sameSite).toBe("lax");
  });

  it("uses the session secret from env", async () => {
    const opts = await loadSessionOptions();
    expect(opts.password).toBe("a-very-long-test-secret-value-12345");
  });

  it("marks cookies secure when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const opts = await loadSessionOptions();
    expect(opts.cookieOptions?.secure).toBe(true);
  });

  it("leaves cookies insecure outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const opts = await loadSessionOptions();
    expect(opts.cookieOptions?.secure).toBe(false);
  });
});
