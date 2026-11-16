import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { ProcessExecutor } from "../src/runner/executor.mjs";

function scriptedSpawn({ stdout = [], stderr = [], exitCode = 0 } = {}) {
  let invocation;
  const spawnImpl = (executable, args, options) => {
    invocation = { executable, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    queueMicrotask(() => {
      for (const chunk of stdout) child.stdout.write(chunk);
      for (const chunk of stderr) child.stderr.write(chunk);
      child.stdout.end();
      child.stderr.end();
      child.emit("close", exitCode, null);
    });
    return child;
  };
  return { spawnImpl, getInvocation: () => invocation };
}

test("ProcessExecutor reads only Codex JSONL completion usage and does not retain structured stdout", async () => {
  const secretLikeText = "This event contains prompt and file details";
  const first = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 41, cached_input_tokens: 17, output_tokens: 12, reasoning_output_tokens: 3 } });
  const fake = scriptedSpawn({ stdout: [
    `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: secretLikeText } })}\n${first.slice(0, 28)}`,
    `${first.slice(28)}`,
  ], stderr: ["Codex diagnostic\n"] });
  const output = [];
  const executor = new ProcessExecutor({
    executable: "codex",
    args: ["exec", "--json", "--", "$PROMPTHUB_PROMPT"],
    spawnImpl: fake.spawnImpl,
    environment: { PATH: "safe-path", CODEX_ACCESS_TOKEN: "not-forwarded" },
  });

  const result = await executor.run({ prompt: "task prompt", worktree: "C:/work", jobId: "job-1", onOutput: (text) => output.push(text) });

  assert.equal(result.ok, true);
  assert.deepEqual(result.usage, { input_tokens: 41, output_tokens: 12, cached_input_tokens: 17, reasoning_output_tokens: 3 });
  assert.equal(result.modelCalls, undefined);
  assert.equal(result.outputTail, "Codex diagnostic\n");
  assert.equal(output.join(""), "Codex diagnostic\n");
  assert.equal(fake.getInvocation().executable, "codex");
  assert.deepEqual(fake.getInvocation().args, ["exec", "--json", "--", "task prompt"]);
  assert.equal(fake.getInvocation().options.shell, false);
  assert.equal(fake.getInvocation().options.env.CODEX_ACCESS_TOKEN, undefined);
});

test("ProcessExecutor preserves split multibyte UTF-8 JSONL lines", async () => {
  const usage = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 9, output_tokens: 4 } });
  const text = `${JSON.stringify({ type: "item.completed", item: { text: "🧪" } })}\n${usage}\n`;
  const bytes = Buffer.from(text);
  const split = bytes.indexOf(Buffer.from("🧪")) + 2;
  const fake = scriptedSpawn({ stdout: [bytes.subarray(0, split), bytes.subarray(split)] });
  const result = await new ProcessExecutor({ executable: "codex", args: ["exec", "--json", "$PROMPTHUB_PROMPT"], spawnImpl: fake.spawnImpl })
    .run({ prompt: "task", worktree: ".", jobId: "job-utf8" });
  assert.deepEqual(result.usage, { input_tokens: 9, output_tokens: 4 });
});

test("ProcessExecutor rejects invalid UTF-8 anywhere in structured output", async () => {
  const usage = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 9, output_tokens: 4 } });
  const bytes = Buffer.concat([Buffer.from('{"type":"thread.started","text":"'), Buffer.from([0xff]), Buffer.from(`"}\n${usage}\n`)]);
  const fake = scriptedSpawn({ stdout: [bytes] });
  const result = await new ProcessExecutor({ executable: "codex", args: ["exec", "--json", "$PROMPTHUB_PROMPT"], spawnImpl: fake.spawnImpl })
    .run({ prompt: "task", worktree: ".", jobId: "job-invalid-utf8" });
  assert.equal(result.usage, null);
  assert.match(result.outputTail, /token telemetry unavailable/);
});

test("ProcessExecutor leaves usage unavailable for malformed or non-JSONL output", async () => {
  const malformed = scriptedSpawn({ stdout: [
    "not-json\n",
    '{"type":"turn.completed","usage":{"input_tokens":"8"}}\n',
    `${JSON.stringify({ type: "turn.completed", usage: { input_tokens: 8, output_tokens: "invalid" } })}\n`,
  ] });
  const jsonResult = await new ProcessExecutor({ executable: "codex", args: ["exec", "--json", "$PROMPTHUB_PROMPT"], spawnImpl: malformed.spawnImpl })
    .run({ prompt: "task", worktree: ".", jobId: "job-json" });
  assert.equal(jsonResult.usage, null);
  assert.equal(jsonResult.ok, true);

  const plain = scriptedSpawn({ stdout: ["plain output with no provider usage"] });
  const plainResult = await new ProcessExecutor({ executable: "codex", args: ["exec", "$PROMPTHUB_PROMPT"], spawnImpl: plain.spawnImpl })
    .run({ prompt: "task", worktree: ".", jobId: "job-plain" });
  assert.equal(plainResult.usage, null);
  assert.match(plainResult.outputTail, /plain output/);

  const promptLikeFlag = scriptedSpawn({ stdout: ["ordinary stdout"] });
  const promptLikeResult = await new ProcessExecutor({ executable: "codex", args: ["exec", "$PROMPTHUB_PROMPT"], spawnImpl: promptLikeFlag.spawnImpl })
    .run({ prompt: "--json", worktree: ".", jobId: "job-plain-flag" });
  assert.equal(promptLikeResult.usage, null);
  assert.match(promptLikeResult.outputTail, /ordinary stdout/);
});

test("ProcessExecutor rejects any completion event with an invalid reported token field", async () => {
  const events = [
    { type: "turn.completed", usage: { input_tokens: 8, output_tokens: "invalid" } },
    { type: "turn.completed", usage: { input_tokens: 8, output_tokens: 3, cached_input_tokens: -1 } },
    { type: "turn.completed", usage: { input_tokens: 8, output_tokens: 3, unrecognized_tokens: 1 } },
    { type: "turn.completed", turn_id: "unverified", usage: { input_tokens: 8, output_tokens: 3 } },
  ];
  for (const [index, event] of events.entries()) {
    const fake = scriptedSpawn({ stdout: [`${JSON.stringify(event)}\n`] });
    const result = await new ProcessExecutor({ executable: "codex", args: ["exec", "--json", "$PROMPTHUB_PROMPT"], spawnImpl: fake.spawnImpl })
      .run({ prompt: "task", worktree: ".", jobId: `job-invalid-usage-${index}` });
    assert.equal(result.usage, null);
    assert.match(result.outputTail, /token telemetry unavailable/);
  }
});

test("ProcessExecutor marks duplicate or bounded JSONL telemetry unavailable", async () => {
  const usage = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 8, output_tokens: 3 } });
  const duplicate = Buffer.from(`${usage}\n${usage}\n`);
  const distinct = Buffer.from(`${usage}\n${JSON.stringify({ type: "thread.started" })}\n${JSON.stringify({ type: "turn.completed", usage: { input_tokens: 9, output_tokens: 2 } })}\n`);
  const cases = [
    { args: { stdout: [duplicate.subarray(0, duplicate.length - 4), duplicate.subarray(duplicate.length - 4)] }, options: {} },
    { args: { stdout: [distinct.subarray(0, usage.length + 3), distinct.subarray(usage.length + 3)] }, options: {} },
    { args: { stdout: [`${usage}\n`] }, options: { maxJsonlBytes: 16 } },
    { args: { stdout: [`${JSON.stringify({ type: "thread.started" })}\n${usage}\n`] }, options: { maxJsonlEvents: 1 } },
    { args: { stdout: [`${usage}\n`] }, options: { maxJsonlLineChars: 32 } },
  ];
  for (const [index, scenario] of cases.entries()) {
    const fake = scriptedSpawn(scenario.args);
    const result = await new ProcessExecutor({
      executable: "codex",
      args: ["exec", "--json", "$PROMPTHUB_PROMPT"],
      spawnImpl: fake.spawnImpl,
      ...scenario.options,
    }).run({ prompt: "task", worktree: ".", jobId: `job-${index}` });
    assert.equal(result.usage, null);
    assert.match(result.outputTail, /token telemetry unavailable/);
  }
});

test("ProcessExecutor bounds cannot be disabled with invalid or oversized options", () => {
  for (const [name, maximum] of [["maxJsonlBytes", 4_000_000], ["maxJsonlEvents", 10_000], ["maxJsonlLineChars", 1_000_000]]) {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, maximum + 1]) {
      assert.throws(() => new ProcessExecutor({ [name]: value }), new RegExp(`${name} must be an integer`));
    }
  }
});

test("ProcessExecutor reports JSONL failures without exposing event messages", async () => {
  const fake = scriptedSpawn({ stdout: [`${JSON.stringify({ type: "error", message: "sensitive provider diagnostic" })}\n`], exitCode: 1 });
  const result = await new ProcessExecutor({ executable: "codex", args: ["exec", "--json", "$PROMPTHUB_PROMPT"], spawnImpl: fake.spawnImpl })
    .run({ prompt: "task", worktree: ".", jobId: "job-failed" });
  assert.equal(result.ok, false);
  assert.match(result.outputTail, /reported an execution failure event/);
  assert.doesNotMatch(result.outputTail, /sensitive provider diagnostic/);
  assert.equal(result.usage, null);
});

test("ProcessExecutor fails when Codex reports a JSONL execution error despite exit code zero", async () => {
  const fake = scriptedSpawn({ stdout: [`${JSON.stringify({ type: "turn.failed", error: { message: "sensitive provider diagnostic" } })}\n`], exitCode: 0 });
  const result = await new ProcessExecutor({ executable: "codex", args: ["exec", "--json", "$PROMPTHUB_PROMPT"], spawnImpl: fake.spawnImpl })
    .run({ prompt: "task", worktree: ".", jobId: "job-failed-zero" });
  assert.equal(result.exitCode, 0);
  assert.equal(result.ok, false);
  assert.match(result.outputTail, /reported an execution failure event/);
  assert.doesNotMatch(result.outputTail, /sensitive provider diagnostic/);
});
