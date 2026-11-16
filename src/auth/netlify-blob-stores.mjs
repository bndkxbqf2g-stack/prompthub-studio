import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from "node:crypto";

const SESSION_PREFIX = "sessions/";
const OAUTH_STATE_PREFIX = "oauth-state/";
const SESSION_ID_PATTERN = /^(\d{13})\.([0-9a-f-]{36})$/;
const STATE_ID_PATTERN = /^([0-9a-z]{1,16})\.([A-Za-z0-9_-]{24,64})$/;
const CLEANUP_SCAN_LIMIT = 100;
const CLEANUP_DELETE_LIMIT = 25;

function sessionExpiryFromId(id) {
  const match = SESSION_ID_PATTERN.exec(id ?? "");
  return match ? Number(match[1]) : null;
}

function stateStartFromKey(key) {
  const state = key.startsWith(OAUTH_STATE_PREFIX) ? key.slice(OAUTH_STATE_PREFIX.length) : "";
  const match = STATE_ID_PATTERN.exec(state);
  if (!match) return null;
  const startedAt = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(startedAt) ? startedAt : null;
}

async function deleteExpiredFromFirstPage(store, prefix, isExpired) {
  if (typeof store.list !== "function") return 0;
  let scanned = 0;
  let deleted = 0;
  for await (const page of store.list({ prefix, paginate: true })) {
    for (const blob of page.blobs ?? []) {
      if (scanned >= CLEANUP_SCAN_LIMIT || deleted >= CLEANUP_DELETE_LIMIT) return deleted;
      scanned += 1;
      if (isExpired(blob.key)) {
        await store.delete(blob.key);
        deleted += 1;
      }
    }
    break;
  }
  return deleted;
}

function deriveEncryptionKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new Error("session secret is too short");
  return Buffer.from(hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from("prompthub-studio/netlify-session", "utf8"),
    Buffer.from("aes-256-gcm/v1", "utf8"),
    32,
  ));
}

function encryptSession(session, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(session.id, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptSession(encrypted, id, key) {
  try {
    if (encrypted?.version !== 1 || typeof encrypted.iv !== "string" || typeof encrypted.ciphertext !== "string" || typeof encrypted.tag !== "string") {
      throw new Error("invalid session record");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64url"));
    decipher.setAAD(Buffer.from(id, "utf8"));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const session = JSON.parse(plaintext);
    if (session.id !== id || !session.user || typeof session.token !== "string" || session.provider !== "github") {
      throw new Error("invalid session record");
    }
    return session;
  } catch {
    throw new Error("server-side session data is invalid");
  }
}

export class NetlifyBlobSessionStore {
  constructor({ store, sessionSecret, now = () => new Date(), ttlMs = 8 * 60 * 60 * 1000 } = {}) {
    if (!store || typeof store.get !== "function" || typeof store.setJSON !== "function" || typeof store.delete !== "function") {
      throw new Error("Netlify Blobs store is required");
    }
    this.store = store;
    this.key = deriveEncryptionKey(sessionSecret);
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async create({ user, token, provider = "github" }) {
    if (typeof token !== "string" || !token || provider !== "github") throw new Error("invalid GitHub session");
    const now = this.now();
    const expiresAtMs = now.getTime() + this.ttlMs;
    const id = `${String(expiresAtMs).padStart(13, "0")}.${randomUUID()}`;
    const session = { id, user, token, provider, createdAt: now.toISOString(), expiresAt: new Date(expiresAtMs).toISOString() };
    const result = await this.store.setJSON(`${SESSION_PREFIX}${id}`, encryptSession(session, this.key), {
      onlyIfNew: true,
      metadata: { expiresAt: session.expiresAt },
    });
    if (!result.modified) throw new Error("session storage collision");
    try {
      await this.clearExpired();
    } catch {
      // Cleanup is opportunistic; it must not invalidate a successfully stored session.
    }
    return id;
  }

  async get(id) {
    const expiresAtMs = sessionExpiryFromId(id);
    if (expiresAtMs === null) return null;
    const key = `${SESSION_PREFIX}${id}`;
    if (expiresAtMs <= this.now().getTime()) {
      await this.store.delete(key);
      return null;
    }
    const encrypted = await this.store.get(key, { consistency: "strong", type: "json" });
    if (!encrypted) return null;
    const session = decryptSession(encrypted, id, this.key);
    if (Date.parse(session.expiresAt) !== expiresAtMs || expiresAtMs <= this.now().getTime()) {
      await this.store.delete(key);
      return null;
    }
    return session;
  }

  async delete(id) {
    if (sessionExpiryFromId(id) === null) return;
    await this.store.delete(`${SESSION_PREFIX}${id}`);
  }

  async clearExpired() {
    const nowMs = this.now().getTime();
    return deleteExpiredFromFirstPage(this.store, SESSION_PREFIX, (key) => {
      const id = key.startsWith(SESSION_PREFIX) ? key.slice(SESSION_PREFIX.length) : "";
      const expiresAtMs = sessionExpiryFromId(id);
      return expiresAtMs !== null && expiresAtMs <= nowMs;
    });
  }
}

export class NetlifyBlobOAuthStateStore {
  constructor({ store, now = () => new Date() } = {}) {
    if (!store || typeof store.getWithMetadata !== "function" || typeof store.setJSON !== "function" || typeof store.delete !== "function") {
      throw new Error("Netlify Blobs store is required");
    }
    this.store = store;
    this.now = now;
  }

  async put(state, pending, ttlSeconds = 600) {
    if (!STATE_ID_PATTERN.test(state ?? "")) throw new Error("invalid OAuth state");
    const expiresAt = new Date(this.now().getTime() + ttlSeconds * 1000).toISOString();
    const result = await this.store.setJSON(`${OAUTH_STATE_PREFIX}${state}`, { pending, expiresAt }, {
      onlyIfNew: true,
      metadata: { expiresAt },
    });
    if (!result.modified) throw new Error("OAuth state storage collision");
    try {
      await this.clearExpired();
    } catch {
      // Cleanup is opportunistic; state creation remains protected by conditional writes.
    }
  }

  async take(state) {
    if (!STATE_ID_PATTERN.test(state ?? "")) return null;
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const record = await this.store.getWithMetadata(key, { consistency: "strong" });
    if (!record?.etag || typeof record.data !== "string") return null;
    let value;
    try {
      value = JSON.parse(record.data);
    } catch {
      await this.store.delete(key);
      return null;
    }
    const expiresAt = Date.parse(value?.expiresAt ?? "");
    if (value?.consumed === true || !value?.pending || !Number.isFinite(expiresAt) || expiresAt <= this.now().getTime()) {
      await this.store.delete(key);
      return null;
    }
    const consumed = await this.store.setJSON(key, { consumed: true, expiresAt: value.expiresAt }, { onlyIfMatch: record.etag });
    if (!consumed.modified) return null;
    await this.store.delete(key);
    return value.pending;
  }

  async clearExpired() {
    const nowMs = this.now().getTime();
    return deleteExpiredFromFirstPage(this.store, OAUTH_STATE_PREFIX, (key) => {
      const startedAt = stateStartFromKey(key);
      return startedAt !== null && startedAt + 10 * 60 * 1000 <= nowMs;
    });
  }
}
