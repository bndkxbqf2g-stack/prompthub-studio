import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../src/pwa/regression-test-request.js", import.meta.url), "utf8");
const browser = {};
runInNewContext(source, browser);
const regressionRequest = browser.PromptHubRegressionTestRequest;

test("only recurring failures or confirmed causes with current evidence can prepare a regression task", () => {
  const base = { id: "incident_123", source: "runner_outcome", occurrence_count: 1, cause_status: "unknown", verified_evidence_available: true };
  assert.equal(regressionRequest.canPrepare(base), false);
  assert.equal(regressionRequest.canPrepare({ ...base, occurrence_count: 3, verified_evidence_available: false }), false);
  assert.equal(regressionRequest.canPrepare({ ...base, occurrence_count: 3 }), true);
  assert.equal(regressionRequest.canPrepare({ ...base, source: "user_report", cause_status: "human_confirmed" }), true);
  assert.equal(regressionRequest.canPrepare({ ...base, source: "user_report", cause_status: "human_confirmed", verified_evidence_available: false }), false);
});

test("prepared regression task keeps observations bounded and requires real regression evidence", () => {
  const incident = {
    id: "incident_123",
    source: "runner_outcome",
    occurrence_count: 2,
    cause_status: "unknown",
    verified_evidence_available: true,
    symptom: {
      category: "required_check_failed",
      summary: "Profile update loses the selected timezone",
      failure_stage: "checks",
      check_names: ["npm test"],
      failure_patterns: ["assertion_failure"],
    },
    components: ["src/profile/update.mjs"],
  };
  const prompt = regressionRequest.build(incident, "owner/product");
  assert.match(prompt, /owner\/product/);
  assert.match(prompt, /incident_123/);
  assert.match(prompt, /occurrence_count/);
  assert.match(prompt, /vor der Korrektur/);
  assert.match(prompt, /Fehler nicht reproduzierbar/);
  assert.match(prompt, /ausdrücklichen Nutzerfreigabe/);
  assert.doesNotMatch(prompt, /raw_stdout|access_token/i);
  assert.throws(() => regressionRequest.build({ ...incident, id: "bad/id" }, "owner/product"), /incident ID/);
  assert.throws(() => regressionRequest.build(incident, "../outside"), /owner\/name/);
});
