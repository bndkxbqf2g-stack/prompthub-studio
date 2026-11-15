const SESSION_PREFIX = "prompthub:session:";
const STATE_PREFIX = "prompthub:oauth-state:";

function storageUnavailable() {
  return Object.assign(new Error("free_serverless_storage_unavailable"), { statusCode: 503 });
}

async function putJson(namespace, key, value, ttlSeconds) {
  try {
    await namespace.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    throw storageUnavailable();
  }
}

async function getJson(namespace, key) {
  try {
    const value = await namespace.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    throw storageUnavailable();
  }
}

async function deleteKey(namespace, key) {
  try {
    await namespace.delete(key);
  } catch {
    throw storageUnavailable();
  }
}

export class CloudflareKVSessionStore {
  constructor({ namespace, now = () => new Date(), ttlMs = 8 * 60 * 60 * 1000 } = {}) {
    if (!namespace || typeof namespace.put !== "function" || typeof namespace.get !== "function" || typeof namespace.delete !== "function") {
      throw new Error("Cloudflare KV namespace binding is required");
    }
    this.namespace = namespace;
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async create({ user, token }) {
    const id = globalThis.crypto.randomUUID();
    const now = this.now();
    const session = { id, user, token, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + this.ttlMs).toISOString() };
    await putJson(this.namespace, `${SESSION_PREFIX}${id}`, session, Math.ceil(this.ttlMs / 1000));
    return id;
  }

  async get(id) {
    const session = await getJson(this.namespace, `${SESSION_PREFIX}${id}`);
    if (!session) return null;
    if (session.expiresAt <= this.now().toISOString()) {
      await deleteKey(this.namespace, `${SESSION_PREFIX}${id}`);
      return null;
    }
    return session;
  }

  async delete(id) {
    await deleteKey(this.namespace, `${SESSION_PREFIX}${id}`);
  }

  async put(state, value, ttlSeconds = 600) {
    await putJson(this.namespace, `${STATE_PREFIX}${state}`, value, ttlSeconds);
  }

  async take(state) {
    const key = `${STATE_PREFIX}${state}`;
    const value = await getJson(this.namespace, key);
    if (value) await deleteKey(this.namespace, key);
    return value;
  }
}
