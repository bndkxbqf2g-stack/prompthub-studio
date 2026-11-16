import test from "node:test";
import assert from "node:assert/strict";
import { NetlifyBlobOAuthStateStore, NetlifyBlobSessionStore } from "../src/auth/netlify-blob-stores.mjs";

class MemoryBlobs {
  constructor() {
    this.values = new Map();
    this.nextEtag = 1;
  }

  async get(key) {
    return this.values.get(key)?.value ?? null;
  }

  async getWithMetadata(key) {
    const record = this.values.get(key);
    return record ? { data: JSON.stringify(record.value), etag: record.etag, metadata: record.metadata } : null;
  }

  async setJSON(key, value, options = {}) {
    const current = this.values.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
    const etag = `"test-${this.nextEtag++}"`;
    this.values.set(key, { value: structuredClone(value), etag, metadata: options.metadata ?? {} });
    return { modified: true, etag };
  }

  async delete(key) {
    this.values.delete(key);
  }

  async *list({ prefix }) {
    const blobs = [...this.values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, record]) => ({ key, etag: record.etag }));
    yield { blobs, directories: [] };
  }
}

test("Netlify session records encrypt GitHub tokens, enforce expiry, and support logout", async () => {
  const blobs = new MemoryBlobs();
  let now = new Date("2026-11-16T12:00:00.000Z");
  const sessions = new NetlifyBlobSessionStore({
    store: blobs,
    sessionSecret: "long-test-session-secret-value-with-entropy",
    now: () => now,
    ttlMs: 60_000,
  });

  const id = await sessions.create({ user: { login: "tester", id: 17 }, token: "github-access-token-private" });
  const stored = blobs.values.get(`sessions/${id}`).value;
  assert.equal(stored.version, 1);
  assert.doesNotMatch(JSON.stringify(stored), /github-access-token-private/);
  assert.equal((await sessions.get(id)).token, "github-access-token-private");

  now = new Date("2026-11-16T12:01:01.000Z");
  assert.equal(await sessions.get(id), null);
  assert.equal(blobs.values.has(`sessions/${id}`), false);
  await sessions.delete(id);
});

test("Netlify OAuth state is single-use under concurrent callbacks", async () => {
  const blobs = new MemoryBlobs();
  const states = new NetlifyBlobOAuthStateStore({ store: blobs, now: () => new Date("2026-11-16T12:00:00.000Z") });
  const id = `m5xxxxxxxx.${"a".repeat(32)}`;
  const pending = { returnTo: "/projects", createdAt: "2026-11-16T12:00:00.000Z" };
  await states.put(id, pending, 600);

  const results = await Promise.all([states.take(id), states.take(id)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(results.find(Boolean), pending);
  assert.equal(blobs.values.has(`oauth-state/${id}`), false);
});

test("Netlify OAuth state expiry and malformed IDs fail closed", async () => {
  const blobs = new MemoryBlobs();
  let now = new Date("2026-11-16T12:00:00.000Z");
  const states = new NetlifyBlobOAuthStateStore({ store: blobs, now: () => now });
  const id = `m5xxxxxxxx.${"b".repeat(32)}`;
  await states.put(id, { returnTo: "/", createdAt: now.toISOString() }, 1);
  now = new Date("2026-11-16T12:00:02.000Z");
  assert.equal(await states.take(id), null);
  assert.equal(await states.take("../../untrusted"), null);
});
