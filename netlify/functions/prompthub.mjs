import process from "node:process";
import { createApplication } from "../../src/application.mjs";
import { readConfig } from "../../src/config.mjs";
import { NetlifyBlobOAuthStateStore, NetlifyBlobSessionStore } from "../../src/auth/netlify-blob-stores.mjs";
import { createNetlifyQuotaGate } from "../../src/hosting/netlify-quota-gate.mjs";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store",
});

function json(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function createNetlifyFunction({
  env = process.env,
  getStore: getStoreOverride,
  applicationFactory = createApplication,
  logger = console,
} = {}) {
  let applicationPromise = null;

  return async function handleNetlifyRequest(request) {
    if (env.CONTEXT !== "production") return json(404, "production_api_disabled");

    let expectedOrigin;
    let requestOrigin;
    try {
      expectedOrigin = new URL(env.PROMPTHUB_PUBLIC_ORIGIN ?? "").origin;
      requestOrigin = new URL(request.url).origin;
    } catch {
      return json(503, "production_origin_not_configured");
    }
    if (expectedOrigin === "null" || expectedOrigin !== requestOrigin) return json(421, "public_origin_mismatch");

    try {
      if (!applicationPromise) {
        applicationPromise = (async () => {
          const runtimeEnv = { ...env, NODE_ENV: "production" };
          const config = readConfig(runtimeEnv);
          if (config.nodeEnv !== "production" || config.mode !== "github" || config.authMode !== "github") {
            throw new Error("production GitHub configuration is required");
          }
          const getStore = getStoreOverride ?? (await import("@netlify/blobs")).getStore;
          const blobStore = getStore({ name: "prompthub-auth-v1", consistency: "strong" });
          const sessionStore = new NetlifyBlobSessionStore({ store: blobStore, sessionSecret: config.sessionSecret });
          const stateStore = new NetlifyBlobOAuthStateStore({ store: blobStore });
          return applicationFactory({
            env: runtimeEnv,
            sessionStore,
            stateStore,
            jobAdmissionGate: createNetlifyQuotaGate(),
            enforceSameOrigin: true,
            logger,
          });
        })();
      }

      const application = await applicationPromise;
      return await application.handler(request) ?? json(404, "not_found");
    } catch (error) {
      logger.error?.({ event: "netlify_function_unavailable", error_class: error?.name ?? "Error" });
      applicationPromise = null;
      return json(503, "control_api_unavailable");
    }
  };
}

const handleRequest = createNetlifyFunction();

export default async function handler(request) {
  return handleRequest(request);
}

export const config = {
  path: ["/api/*", "/auth/*", "/healthz"],
};
