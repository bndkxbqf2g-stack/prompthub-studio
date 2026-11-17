import { sha256Hex } from "../security/web-crypto.mjs";

const SESSION_TABLE = "prompthub_auth_sessions";
const STATE_TABLE = "prompthub_oauth_states";
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATE_ID_PATTERN = /^([0-9a-z]{1,16})\.([A-Za-z0-9_-]{24,64})$/;
const MAX_STATE_TTL_SECONDS = 600;
const MAX_SESSION_TOKEN_BYTES = 8 * 1024;
const MAX_SESSION_USER_BYTES = 8 * 1024;
const MAX_RETURN_TO_BYTES = 2 * 1024;
const CLEANUP_LIMIT = 25;
const STORAGE_ERROR = "free_serverless_storage_unavailable";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function storageUnavailable() {
  return Object.assign(new Error(STORAGE_ERROR), { statusCode: 503 });
}

function isSessionId(value) {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

function validPending(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.returnTo !== "string" || encoder.encode(value.returnTo).byteLength > MAX_RETURN_TO_BYTES
    || !value.returnTo.startsWith("/") || value.returnTo.startsWith("//")) return false;
  if (value.returnTo.includes("\\") || /[\u0000-\u001f\u007f]/.test(value.returnTo)) return false;
  return typeof value.createdAt === "string" && value.createdAt.length <= 64 && Number.isFinite(Date.parse(value.createdAt));
}

function validSessionInput(user, token, provider) {
  if (!user || typeof user !== "object" || Array.isArray(user) || provider !== "github") return false;
  if (typeof user.login !== "string" || user.login.length === 0 || user.login.length > 100 || /[\u0000-\u001f\u007f]/.test(user.login)) return false;
  if (!(typeof user.id === "string" && user.id.length > 0 && user.id.length <= 100)
    && !(Number.isSafeInteger(user.id) && user.id >= 0)) return false;
  if (user.name !== undefined && (typeof user.name !== "string" || user.name.length > 256)) return false;
  if (user.avatar_url !== undefined && (typeof user.avatar_url !== "string" || user.avatar_url.length > 2048)) return false;
  if (typeof token !== "string" || token.length === 0 || encoder.encode(token).byteLength > MAX_SESSION_TOKEN_BYTES
    || /[\u0000-\u001f\u007f]/.test(token)) return false;
  return encoder.encode(JSON.stringify(user)).byteLength <= MAX_SESSION_USER_BYTES;
}

function base64UrlFromBytes(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function bytesFromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid encrypted record");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(secret, purpose) {
  const material = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("prompthub-studio/cloudflare-auth-store/v1"),
      info: encoder.encode(`AES-256-GCM/${purpose}/v1`),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptJson(value, key, aad) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad), tagLength: 128 },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return JSON.stringify({
    version: 1,
    iv: base64UrlFromBytes(iv),
    ciphertext: base64UrlFromBytes(new Uint8Array(ciphertext)),
  });
}

async function decryptJson(payload, key, aad) {
  try {
    const envelope = JSON.parse(payload);
    if (envelope?.version !== 1) throw new Error("invalid encrypted record");
    const iv = bytesFromBase64Url(envelope.iv);
    const ciphertext = bytesFromBase64Url(envelope.ciphertext);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 16) throw new Error("invalid encrypted record");
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(aad), tagLength: 128 },
      key,
      ciphertext,
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    throw storageUnavailable();
  }
}

function bind(database, sql, values = []) {
  const statement = database.prepare(sql);
  if (!statement || typeof statement.bind !== "function") throw storageUnavailable();
  return statement.bind(...values);
}

async function first(database, sql, values = []) {
  try {
    const statement = bind(database, sql, values);
    if (typeof statement.first !== "function") throw storageUnavailable();
    return await statement.first();
  } catch {
    throw storageUnavailable();
  }
}

async function run(database, sql, values = []) {
  try {
    const statement = bind(database, sql, values);
    if (typeof statement.run !== "function") throw storageUnavailable();
    const result = await statement.run();
    if (!result || result.success === false) throw storageUnavailable();
    return result;
  } catch {
    throw storageUnavailable();
  }
}

async function encryptionKey(keyPromise) {
  try {
    return await keyPromise;
  } catch {
    throw storageUnavailable();
  }
}

async function bestEffortCleanup(database, table, keyColumn, nowMs) {
  const sql = `DELETE FROM ${table} WHERE ${keyColumn} IN (SELECT ${keyColumn} FROM ${table} WHERE expires_at <= ? LIMIT ?)`;
  try {
    await run(database, sql, [nowMs, CLEANUP_LIMIT]);
  } catch {
    // Expired-row cleanup is opportunistic; it never changes an auth decision.
  }
}

export class CloudflareD1SessionStore {
  constructor({ database, sessionSecret, now = () => new Date(), ttlMs = 8 * 60 * 60 * 1000 } = {}) {
    if (!database || typeof database.prepare !== "function") throw new Error("Cloudflare D1 database binding is required");
    if (typeof sessionSecret !== "string" || sessionSecret.length < 32) throw new Error("session secret is too short");
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error("session lifetime is invalid");
    this.database = database;
    this.sessionKeyPromise = deriveKey(sessionSecret, "session");
    this.stateKeyPromise = deriveKey(sessionSecret, "oauth-state");
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async create({ user, token, provider = "github" } = {}) {
    if (!validSessionInput(user, token, provider)) {
      throw new Error("invalid GitHub session");
    }
    const storedUser = {
      login: user.login,
      id: user.id,
      ...(user.name === undefined ? {} : { name: user.name }),
      ...(user.avatar_url === undefined ? {} : { avatar_url: user.avatar_url }),
    };
    const now = this.now();
    const nowMs = now instanceof Date ? now.getTime() : NaN;
    if (!Number.isSafeInteger(nowMs)) throw storageUnavailable();
    const expiresAtMs = nowMs + this.ttlMs;
    if (!Number.isSafeInteger(expiresAtMs)) throw storageUnavailable();
    const id = globalThis.crypto.randomUUID();
    const session = {
      id,
      user: storedUser,
      token,
      provider,
      createdAt: now.toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
    let encrypted;
    try {
      encrypted = await encryptJson(session, await encryptionKey(this.sessionKeyPromise), `session:${id}`);
    } catch {
      throw storageUnavailable();
    }
    const row = await first(this.database,
      `INSERT INTO ${SESSION_TABLE} (id, payload, expires_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [id, encrypted, expiresAtMs]);
    if (!row || row.id !== id) throw storageUnavailable();
    await bestEffortCleanup(this.database, SESSION_TABLE, "id", nowMs);
    return id;
  }

  async get(id) {
    if (!isSessionId(id)) return null;
    const row = await first(this.database,
      `SELECT payload, expires_at FROM ${SESSION_TABLE} WHERE id = ? LIMIT 1`, [id]);
    if (!row) return null;
    const now = this.now();
    const nowMs = now instanceof Date ? now.getTime() : NaN;
    if (!Number.isSafeInteger(nowMs)) throw storageUnavailable();
    if (!Number.isSafeInteger(row.expires_at) || row.expires_at <= nowMs) return null;
    const session = await decryptJson(row.payload, await encryptionKey(this.sessionKeyPromise), `session:${id}`);
    if (session?.id !== id || session.provider !== "github" || typeof session.token !== "string" || !session.token) throw storageUnavailable();
    if (!session.user || typeof session.user.login !== "string" || !session.user.login || !Number.isFinite(Date.parse(session.createdAt))) throw storageUnavailable();
    if (Date.parse(session.expiresAt) !== row.expires_at || row.expires_at <= nowMs) throw storageUnavailable();
    return session;
  }

  async delete(id) {
    if (!isSessionId(id)) return;
    await run(this.database, `DELETE FROM ${SESSION_TABLE} WHERE id = ?`, [id]);
  }

  async put(state, pending, ttlSeconds = MAX_STATE_TTL_SECONDS) {
    if (!STATE_ID_PATTERN.test(state ?? "") || !validPending(pending)) throw new Error("invalid OAuth state");
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_STATE_TTL_SECONDS) throw new Error("invalid OAuth state lifetime");
    const now = this.now();
    const nowMs = now instanceof Date ? now.getTime() : NaN;
    if (!Number.isSafeInteger(nowMs)) throw storageUnavailable();
    const expiresAtMs = nowMs + ttlSeconds * 1000;
    let stateHash;
    let encrypted;
    try {
      stateHash = await sha256Hex(state);
      encrypted = await encryptJson({ pending, expiresAt: expiresAtMs }, await encryptionKey(this.stateKeyPromise), `oauth-state:${stateHash}`);
    } catch {
      throw storageUnavailable();
    }
    const row = await first(this.database,
      `INSERT INTO ${STATE_TABLE} (state_hash, payload, expires_at) VALUES (?, ?, ?) ON CONFLICT(state_hash) DO NOTHING RETURNING state_hash`,
      [stateHash, encrypted, expiresAtMs]);
    if (!row || row.state_hash !== stateHash) throw storageUnavailable();
    await bestEffortCleanup(this.database, STATE_TABLE, "state_hash", nowMs);
  }

  async take(state) {
    if (!STATE_ID_PATTERN.test(state ?? "")) return null;
    const now = this.now();
    const nowMs = now instanceof Date ? now.getTime() : NaN;
    if (!Number.isSafeInteger(nowMs)) throw storageUnavailable();
    let stateHash;
    try {
      stateHash = await sha256Hex(state);
    } catch {
      throw storageUnavailable();
    }
    const row = await first(this.database,
      `SELECT payload, expires_at FROM ${STATE_TABLE} WHERE state_hash = ? AND expires_at > ? LIMIT 1`,
      [stateHash, nowMs]);
    if (!row) return null;
    const record = await decryptJson(row.payload, await encryptionKey(this.stateKeyPromise), `oauth-state:${stateHash}`);
    if (!validPending(record?.pending) || record.expiresAt !== row.expires_at || row.expires_at <= nowMs) throw storageUnavailable();

    // Only consume the exact row that was validated. Concurrent callbacks may
    // decrypt the same row, but the conditional DELETE grants one winner.
    const consumeNow = this.now();
    const consumeNowMs = consumeNow instanceof Date ? consumeNow.getTime() : NaN;
    if (!Number.isSafeInteger(consumeNowMs)) throw storageUnavailable();
    if (row.expires_at <= consumeNowMs) return null;
    const consumed = await first(this.database,
      `DELETE FROM ${STATE_TABLE} WHERE state_hash = ? AND payload = ? AND expires_at = ? AND expires_at > ? RETURNING state_hash`,
      [stateHash, row.payload, row.expires_at, consumeNowMs]);
    if (!consumed) return null;
    return record.pending;
  }
}
