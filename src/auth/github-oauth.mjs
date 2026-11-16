import { GitHubClient } from "../control/github-client.mjs";
import { hmacBase64Url, randomBase64Url, verifyHmacBase64Url } from "../security/web-crypto.mjs";

function cookieHeader(request) {
  if (typeof request?.headers?.get === "function") return request.headers.get("cookie") ?? "";
  return request?.headers?.cookie ?? "";
}

export function safeLocalRedirectPath(value, origin) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.pathname.startsWith("//") || target.pathname.includes("\\")) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export function parseCookies(header = "") {
  const result = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

export function serializeCookie(name, value, { maxAge = 0, httpOnly = true, sameSite = "Lax", secure = false, path = "/" } = {}) {
  const pieces = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (maxAge !== undefined) pieces.push(`Max-Age=${maxAge}`);
  if (httpOnly) pieces.push("HttpOnly");
  if (secure) pieces.push("Secure");
  return pieces.join("; ");
}

export class SessionStore {
  constructor({ now = () => new Date(), ttlMs = 8 * 60 * 60 * 1000 } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.sessions = new Map();
  }

  create({ user, token, provider = null }) {
    const id = globalThis.crypto.randomUUID();
    const now = this.now();
    this.sessions.set(id, { id, user, token, provider, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + this.ttlMs).toISOString() });
    return id;
  }

  get(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (session.expiresAt <= this.now().toISOString()) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  delete(id) {
    this.sessions.delete(id);
  }

  clearExpired() {
    const now = this.now().toISOString();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }
}

export class LocalAuth {
  constructor({ production = false } = {}) {
    if (production) throw new Error("LocalAuth cannot be used in production");
    this.user = { login: "local-user", id: "local", name: "Local development session" };
  }

  async getSession() {
    return { user: this.user, provider: "local", local: true };
  }

  async logout() {}
}

export class GitHubOAuth {
  constructor({ clientId, clientSecret, scopes = ["read:user", "repo"], publicOrigin, sessionSecret, allowedLogins = [], production = false, fetchImpl = globalThis.fetch, now = () => new Date(), store = new SessionStore({ now }), stateStore = null } = {}) {
    if (!clientId || !clientSecret) throw new Error("GitHub OAuth credentials are required");
    if (!sessionSecret || sessionSecret.length < 32) throw new Error("session secret is too short");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scopes = scopes;
    this.publicOrigin = publicOrigin.replace(/\/$/, "");
    this.sessionSecret = sessionSecret;
    this.allowedLogins = new Set(allowedLogins);
    this.production = production;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.store = store;
    this.stateStore = stateStore;
    this.states = new Map();
    this.cookieSecure = production;
  }

  async start({ returnTo = "/" } = {}) {
    const createdAt = this.now();
    const state = `${createdAt.getTime().toString(36)}.${randomBase64Url(24)}`;
    const pending = { returnTo: safeLocalRedirectPath(returnTo, this.publicOrigin), createdAt: createdAt.toISOString() };
    if (this.stateStore) await this.stateStore.put(state, pending, 600);
    else this.states.set(state, pending);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", `${this.publicOrigin}/auth/github/callback`);
    url.searchParams.set("scope", this.scopes.join(" "));
    url.searchParams.set("state", state);
    return {
      location: url.toString(),
      cookie: serializeCookie("prompthub_oauth_state", state, { maxAge: 600, secure: this.cookieSecure }),
    };
  }

  async callback({ code, state, cookies = {} } = {}) {
    if (!code || !state || cookies.prompthub_oauth_state !== state) throw new Error("OAuth state validation failed");
    const pending = this.stateStore ? await this.stateStore.take(state) : this.states.get(state);
    this.states.delete(state);
    if (!pending || new Date(pending.createdAt).getTime() + 10 * 60 * 1000 < this.now().getTime()) throw new Error("OAuth state expired");
    const response = await this.fetchImpl("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, code }),
    });
    const tokenPayload = await response.json();
    if (!response.ok || !tokenPayload.access_token) throw new Error("GitHub OAuth exchange failed");
    const github = new GitHubClient({ token: tokenPayload.access_token, fetchImpl: this.fetchImpl });
    const profile = await github.getUser();
    if (this.allowedLogins.size > 0 && !this.allowedLogins.has(profile.login)) throw new Error("GitHub account is not allowed");
    const sessionId = await this.store.create({ user: { login: profile.login, id: profile.id, name: profile.name ?? profile.login, avatar_url: profile.avatar_url }, token: tokenPayload.access_token, provider: "github" });
    const cookieValue = `${sessionId}.${await hmacBase64Url(sessionId, this.sessionSecret)}`;
    return {
      redirectTo: safeLocalRedirectPath(pending.returnTo, this.publicOrigin),
      cookie: serializeCookie("prompthub_session", cookieValue, { maxAge: 8 * 60 * 60, secure: this.cookieSecure }),
      user: { login: profile.login, id: profile.id, name: profile.name ?? profile.login, avatar_url: profile.avatar_url },
    };
  }

  async getSession(request) {
    const cookies = parseCookies(cookieHeader(request));
    const value = cookies.prompthub_session ?? "";
    const index = value.lastIndexOf(".");
    if (index === -1) return null;
    const id = value.slice(0, index);
    const signature = value.slice(index + 1);
    if (!id || !await verifyHmacBase64Url(id, signature, this.sessionSecret)) return null;
    return await this.store.get(id);
  }

  async logout(request) {
    const cookies = parseCookies(cookieHeader(request));
    const value = cookies.prompthub_session ?? "";
    const index = value.lastIndexOf(".");
    if (index > 0) await this.store.delete(value.slice(0, index));
    return serializeCookie("prompthub_session", "", { maxAge: 0, secure: this.cookieSecure });
  }
}
