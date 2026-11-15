import test from "node:test";
import assert from "node:assert/strict";
import { GitHubOAuth, parseCookies, safeLocalRedirectPath } from "../src/auth/github-oauth.mjs";

test("GitHub OAuth uses server-side token storage and validates state", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://github.com/login/oauth/access_token") {
      return new Response(JSON.stringify({ access_token: "server-side-only" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://api.github.com/user") {
      return new Response(JSON.stringify({ id: 7, login: "allowed-user", name: "Allowed User", avatar_url: "" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  const auth = new GitHubOAuth({
    clientId: "client",
    clientSecret: "secret",
    publicOrigin: "https://control.example",
    sessionSecret: "a-session-secret-that-is-long-enough-for-tests",
    allowedLogins: ["allowed-user"],
    production: true,
    fetchImpl,
  });
  const start = await auth.start();
  const state = new URL(start.location).searchParams.get("state");
  const cookies = parseCookies(start.cookie);
  await assert.rejects(() => auth.callback({ code: "code", state: "wrong", cookies }), /state/);
  const result = await auth.callback({ code: "code", state, cookies });
  assert.match(result.cookie, /Secure/);
  assert.equal(result.user.login, "allowed-user");
  const session = await auth.getSession({ headers: { cookie: result.cookie } });
  assert.equal(session.user.login, "allowed-user");
  assert.equal(session.token, "server-side-only");
  assert.doesNotMatch(result.cookie, /server-side-only/);
  await auth.logout({ headers: { cookie: result.cookie } });
  assert.equal(await auth.getSession({ headers: { cookie: result.cookie } }), null);
});

test("OAuth state can use a shared expiring server-side store", async () => {
  const values = new Map();
  const stateStore = {
    async put(key, value) { values.set(key, value); },
    async take(key) { const value = values.get(key) ?? null; values.delete(key); return value; },
  };
  const auth = new GitHubOAuth({
    clientId: "client", clientSecret: "secret", publicOrigin: "https://control.example",
    sessionSecret: "a-session-secret-that-is-long-enough-for-tests", stateStore,
    fetchImpl: async () => new Response(JSON.stringify({ access_token: "server-only" }), { status: 200 }),
  });
  const start = await auth.start();
  const state = new URL(start.location).searchParams.get("state");
  assert.equal(values.has(state), true);
  assert.equal(auth.states.size, 0);
});

test("OAuth redirects remain same-origin for normal and normalized return paths", async () => {
  const fetchImpl = async (url) => url === "https://github.com/login/oauth/access_token"
    ? new Response(JSON.stringify({ access_token: "server-side-only" }), { status: 200 })
    : new Response(JSON.stringify({ id: 7, login: "allowed-user" }), { status: 200 });
  const invalidReturnPaths = [
    "//attacker.example/path",
    "https://attacker.example/path",
    "/\\attacker.example/path",
    "/%2e%2e//attacker.example/path",
    "/path\r\nLocation: https://attacker.example",
  ];

  for (const returnTo of invalidReturnPaths) {
    const auth = new GitHubOAuth({
      clientId: "client", clientSecret: "secret", publicOrigin: "https://control.example",
      sessionSecret: "a-session-secret-that-is-long-enough-for-tests", allowedLogins: ["allowed-user"],
      production: true, fetchImpl,
    });
    const start = await auth.start({ returnTo });
    const state = new URL(start.location).searchParams.get("state");
    const cookies = parseCookies(start.cookie);
    const result = await auth.callback({ code: "code", state, cookies });
    assert.equal(result.redirectTo, "/", `unsafe return path ${JSON.stringify(returnTo)} must fall back to the root`);
  }

  const auth = new GitHubOAuth({
    clientId: "client", clientSecret: "secret", publicOrigin: "https://control.example",
    sessionSecret: "a-session-secret-that-is-long-enough-for-tests", allowedLogins: ["allowed-user"],
    production: true, fetchImpl,
  });
  const start = await auth.start({ returnTo: "/dashboard?tab=projects#recent" });
  const state = new URL(start.location).searchParams.get("state");
  const result = await auth.callback({ code: "code", state, cookies: parseCookies(start.cookie) });
  assert.equal(result.redirectTo, "/dashboard?tab=projects#recent");
});

test("OAuth callback revalidates a return path loaded from the shared state store", async () => {
  const values = new Map();
  const stateStore = {
    async put(key, value) { values.set(key, value); },
    async take(key) { const value = values.get(key) ?? null; values.delete(key); return value; },
  };
  const fetchImpl = async (url) => url === "https://github.com/login/oauth/access_token"
    ? new Response(JSON.stringify({ access_token: "server-side-only" }), { status: 200 })
    : new Response(JSON.stringify({ id: 7, login: "allowed-user" }), { status: 200 });
  const auth = new GitHubOAuth({
    clientId: "client", clientSecret: "secret", publicOrigin: "https://control.example",
    sessionSecret: "a-session-secret-that-is-long-enough-for-tests", allowedLogins: ["allowed-user"],
    production: true, fetchImpl, stateStore,
  });
  const start = await auth.start({ returnTo: "/dashboard" });
  const state = new URL(start.location).searchParams.get("state");
  values.set(state, { returnTo: "/%2e%2e//attacker.example/path", createdAt: new Date().toISOString() });
  const result = await auth.callback({ code: "code", state, cookies: parseCookies(start.cookie) });
  assert.equal(result.redirectTo, "/");
});

test("encoded slash and backslash return paths cannot change the destination origin", () => {
  const origin = "https://control.example";
  for (const returnTo of ["/%2f%2fattacker.example/path", "/%5c%5cattacker.example/path"]) {
    const redirectPath = safeLocalRedirectPath(returnTo, origin);
    assert.equal(new URL(redirectPath, origin).origin, origin);
    assert.equal(redirectPath.startsWith("//"), false);
  }
});
