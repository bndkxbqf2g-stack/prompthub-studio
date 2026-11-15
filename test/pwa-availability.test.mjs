import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../src/pwa/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/pwa/app.js", import.meta.url), "utf8");

test("PWA explains an unavailable Control API and keeps the app hidden", () => {
  assert.match(html, /id="unavailable-panel"[^>]*hidden/);
  assert.match(html, /separate serverseitige Control API/);
  assert.match(html, /diese Bereiche verborgen/);
  assert.match(app, /elements\.unavailablePanel\.hidden = false/);
  assert.match(app, /elements\.appPanel\.hidden = true/);
});

test("refresh retries bootstrap and reports success only when bootstrap succeeds", () => {
  assert.match(app, /const refreshed = await boot\(\);\s*if \(refreshed\) notice\("Projekt- und Nutzungsübersicht aktualisiert\.", "success"\)/);
  assert.match(app, /return true;\s*\} catch \(error\)/);
  assert.match(app, /return false;/);
});
