import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/application.mjs";
import { createNetlifyQuotaGate } from "../src/hosting/netlify-quota-gate.mjs";

test("shared application factory loads the project library and applies production job gates", async () => {
  const application = await createApplication({
    env: { NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local", PROMPTHUB_ALLOWED_PROJECTS: "demo" },
    jobAdmissionGate: createNetlifyQuotaGate(),
    logger: { error() {} },
  });

  assert.ok(application.promptLibrary.entries.length > 0);
  const health = await application.handler(new Request("https://hub.example/healthz"));
  assert.equal((await health.json()).job_admission.status, "unknown");

  const response = await application.handler(new Request("https://hub.example/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "do work", project: "demo" }),
  }));
  assert.equal(response.status, 503);
});
