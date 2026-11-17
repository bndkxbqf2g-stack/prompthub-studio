import test from "node:test";
import assert from "node:assert/strict";
import { CloudflareD1SessionStore } from "../src/cloudflare/d1-session-store.mjs";
import { sha256Hex } from "../src/security/web-crypto.mjs";
import { MemoryD1Database } from "./helpers/memory-d1.mjs";

const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const OAUTH_STATE = "10.abcdefghijklmnopqrstuvwx123456";

function fixedTime() {
  let current = new Date("2026-11-17T12:00:00.000Z");
  return {
    now: () => new Date(current),
    advance: (milliseconds) => { current = new Date(current.getTime() + milliseconds); },
  };
}

test("D1 sessions encrypt the GitHub token at rest and validate expiry and integrity", async () => {
  const database = new MemoryD1Database();
  const time = fixedTime();
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET, now: time.now, ttlMs: 60_000 });
  const input = {
    user: { login: "allowed-user", id: 7, name: "Allowed" },
    token: "private-github-access-token",
    provider: "github",
  };

  const id = await store.create(input);
  const stored = database.sessions.get(id);
  assert.ok(stored);
  assert.equal(stored.payload.includes(input.token), false);
  assert.deepEqual(await store.get(id), {
    id,
    ...input,
    createdAt: time.now().toISOString(),
    expiresAt: new Date(time.now().getTime() + 60_000).toISOString(),
  });

  stored.payload = `${stored.payload.slice(0, -2)}AA`;
  await assert.rejects(store.get(id), (error) => error.statusCode === 503 && error.message === "free_serverless_storage_unavailable");

  await store.delete(id);
  assert.equal(await store.get(id), null);

  const expiredId = await store.create(input);
  time.advance(60_000);
  assert.equal(await store.get(expiredId), null);
});

test("OAuth state is hashed, encrypted, and atomically consumed once under concurrency", async () => {
  const database = new MemoryD1Database();
  const time = fixedTime();
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET, now: time.now });
  const pending = { returnTo: "/?tab=jobs", createdAt: time.now().toISOString() };

  await store.put(OAUTH_STATE, pending, 600);
  const stateHash = await sha256Hex(OAUTH_STATE);
  const stored = database.states.get(stateHash);
  assert.ok(stored);
  assert.equal(database.states.has(OAUTH_STATE), false);
  assert.equal(stored.payload.includes(JSON.stringify(pending)), false);
  assert.equal(stored.payload.includes(OAUTH_STATE), false);

  const [first, second] = await Promise.all([store.take(OAUTH_STATE), store.take(OAUTH_STATE)]);
  assert.equal([first, second].filter(Boolean).length, 1);
  assert.deepEqual(first ?? second, pending);
  assert.equal(database.states.size, 0);
  assert.equal(await store.take(OAUTH_STATE), null);
});

test("corrupt OAuth state fails closed without consuming the row before validation", async () => {
  const database = new MemoryD1Database();
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET });
  await store.put(OAUTH_STATE, { returnTo: "/", createdAt: new Date().toISOString() });
  const stateHash = await sha256Hex(OAUTH_STATE);
  const row = database.states.get(stateHash);
  row.payload = `${row.payload.slice(0, -2)}AA`;

  await assert.rejects(store.take(OAUTH_STATE), (error) => error.statusCode === 503);
  assert.equal(database.states.has(stateHash), true);
});

test("OAuth state that expires during validation is not consumed", async () => {
  const database = new MemoryD1Database();
  const time = fixedTime();
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET, now: time.now });
  await store.put(OAUTH_STATE, { returnTo: "/", createdAt: time.now().toISOString() }, 1);
  const stateHash = await sha256Hex(OAUTH_STATE);
  let clockReads = 0;
  store.now = () => new Date(time.now().getTime() + (clockReads++ === 0 ? 500 : 1_001));

  assert.equal(await store.take(OAUTH_STATE), null);
  assert.equal(database.states.has(stateHash), true);
});

test("expired OAuth state and malformed input are not accepted", async () => {
  const database = new MemoryD1Database();
  const time = fixedTime();
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET, now: time.now });
  const pending = { returnTo: "/", createdAt: time.now().toISOString() };
  await store.put(OAUTH_STATE, pending, 1);
  time.advance(1_001);
  assert.equal(await store.take(OAUTH_STATE), null);
  await assert.rejects(store.put("bad-state", pending), /invalid OAuth state/);
  await assert.rejects(store.put(OAUTH_STATE, { returnTo: "//evil.example", createdAt: time.now().toISOString() }), /invalid OAuth state/);
  await assert.rejects(store.put(OAUTH_STATE, pending, 601), /invalid OAuth state lifetime/);
});

test("D1 failures fail closed without exposing provider error text", async () => {
  const database = new MemoryD1Database();
  database.failNext = true;
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET });
  await assert.rejects(store.create({ user: { login: "alice", id: 1 }, token: "secret" }), (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.message, "free_serverless_storage_unavailable");
    assert.doesNotMatch(error.message, /simulated|secret/i);
    return true;
  });
});

test("D1 auth store refuses missing database bindings and weak encryption secrets", () => {
  assert.throws(() => new CloudflareD1SessionStore({ sessionSecret: SESSION_SECRET }), /D1 database binding is required/);
  assert.throws(() => new CloudflareD1SessionStore({ database: new MemoryD1Database(), sessionSecret: "short" }), /session secret is too short/);
});

test("D1 session input is bounded and stores only the GitHub profile fields used by the app", async () => {
  const database = new MemoryD1Database();
  const store = new CloudflareD1SessionStore({ database, sessionSecret: SESSION_SECRET });
  const id = await store.create({
    user: { login: "allowed-user", id: 7, name: "Allowed", avatar_url: "https://avatars.githubusercontent.com/u/7", private_note: "must not persist" },
    token: "private-github-access-token",
  });
  assert.deepEqual((await store.get(id)).user, {
    login: "allowed-user",
    id: 7,
    name: "Allowed",
    avatar_url: "https://avatars.githubusercontent.com/u/7",
  });

  await assert.rejects(store.create({ user: { login: "alice", id: 1 }, token: "x".repeat(8 * 1024 + 1) }), /invalid GitHub session/);
  await assert.rejects(store.create({ user: { login: "alice", id: 1, name: "x".repeat(9 * 1024) }, token: "token" }), /invalid GitHub session/);
  await assert.rejects(store.put(OAUTH_STATE, { returnTo: `/${"x".repeat(2 * 1024)}`, createdAt: new Date().toISOString() }), /invalid OAuth state/);
});
