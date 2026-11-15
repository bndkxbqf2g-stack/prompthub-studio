import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CI whitespace check compares the actual PR or pushed commit range", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /name: Check pull request patch whitespace[\s\S]*?if: github\.event_name == 'pull_request'[\s\S]*?run: git -c core\.whitespace=cr-at-eol diff --check "\$PR_BASE_SHA\.\.\.\$PR_HEAD_SHA"/);
  assert.match(workflow, /name: Check pushed patch whitespace[\s\S]*?if: github\.event_name == 'push'[\s\S]*?run: git -c core\.whitespace=cr-at-eol diff --check "\$PUSH_BEFORE_SHA\.\.\.\$PUSH_HEAD_SHA"/);
  assert.doesNotMatch(workflow, /run:\s*git diff --check\s*$/m);
});
