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

test("required test check blocks unless both free public macOS lanes pass", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(workflow, /macos:\r?\n\s+name: macOS checks/);
  assert.match(workflow, /if: github\.event\.repository\.private == false/);
  assert.match(workflow, /runner: \[macos-latest, macos-15-intel\]/);
  assert.match(workflow, /name: macOS checks[\s\S]*?run: npm test[\s\S]*?run: npm run check/);
  assert.match(workflow, /test:\r?\n\s+if: always\(\)\r?\n\s+needs: macos/);
  assert.match(workflow, /name: Require successful macOS verification\r?\n\s+if: needs\.macos\.result != 'success'[\s\S]*?exit 1/);
});
