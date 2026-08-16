import { describe, expect, it } from "vitest";
import { createApiClient } from "./http";
import { TEST_TEACHER } from "./config";

describe("auth", () => {
  it("rejects invalid credentials", async () => {
    const client = createApiClient();
    const res = await client.login("teacher", "wrong-password");
    expect(res.status).toBe(401);
  });

  it("rejects empty payloads", async () => {
    const client = createApiClient();
    const res = await client.req("/api/auth/login", {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it("logs in and sets a session cookie", async () => {
    const client = createApiClient();
    const res = await client.login(
      TEST_TEACHER.username,
      TEST_TEACHER.password,
    );
    expect(res.status).toBe(200);
    expect(client.cookie).toMatch(/^quizforge_session=/);
  });

  it("redirects unauthenticated requests to login", async () => {
    const client = createApiClient();
    const res = await client.req("/api/quiz");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows authenticated requests", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const res = await client.req("/api/quiz");
    expect(res.status).toBe(200);
  });

  it("logs out and clears the session", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const logout = await client.req("/api/auth/logout", { method: "POST" });
    expect(logout.status).toBe(200);
    const after = await client.req("/api/quiz");
    expect(after.status).toBe(307);
  });
});
