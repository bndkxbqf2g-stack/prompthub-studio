import test from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.mjs";
import { LocalAuth } from "../src/auth/github-oauth.mjs";
import { createControlPlane } from "../src/control/index.mjs";
import { createHttpServer } from "../src/api/server.mjs";

async function withServer(callback) {
  const config = readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local", PROMPTHUB_ALLOWED_PROJECTS: "demo", CODEX_ARGS_JSON: '["exec","--","$PROMPTHUB_PROMPT"]' });
  const server = createHttpServer({ config, controlPlane: createControlPlane(config), auth: new LocalAuth() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("PWA/API vertical slice creates and displays real job states", async () => {
  await withServer(async (base) => {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.runner_inbound_port, false);
    assert.equal(healthPayload.runner_status, "not_observed");
    assert.equal(healthPayload.runner_configured, false);
    const pwa = await fetch(`${base}/`);
    assert.equal(pwa.status, 200);
    assert.match(pwa.headers.get("content-security-policy"), /script-src 'self'/);
    const pwaHtml = await pwa.text();
    assert.match(pwaHtml, /apple-touch-icon/);
    assert.match(pwaHtml, /regression-test-request\.js/);
    const regressionRequest = await fetch(`${base}/regression-test-request.js`);
    assert.equal(regressionRequest.status, 200);
    assert.match(regressionRequest.headers.get("content-type"), /javascript/);
    assert.match(await regressionRequest.text(), /PromptHubRegressionTestRequest/);
    const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
    assert.equal(manifest.icons[0].src, "/app-icon-source.png");
    const icon = await fetch(`${base}/app-icon-source.png`);
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("content-type"), "image/png");
    assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const create = await fetch(`${base}/api/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Build a demo", project: "demo" }) });
    assert.equal(create.status, 201);
    const created = (await create.json()).job;
    assert.equal(created.status, "queued");
    const list = await fetch(`${base}/api/jobs`);
    assert.equal((await list.json()).jobs[0].status, "queued");
  });
});

test("approval endpoint requires the explicit human decision", async () => {
  await withServer(async (base) => {
    const create = await fetch(`${base}/api/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Review before execution", project: "demo", requiresApproval: true }) });
    const created = (await create.json()).job;
    const approve = await fetch(`${base}/api/jobs/${created.id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "approve" }) });
    assert.equal(approve.status, 200);
    assert.equal((await approve.json()).job.status, "queued");
  });
});
