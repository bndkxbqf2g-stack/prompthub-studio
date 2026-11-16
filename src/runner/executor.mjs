import process from "node:process";
import { spawn as nodeSpawn } from "node:child_process";
import { TextDecoder } from "node:util";

const USAGE_FIELDS = ["input_tokens", "output_tokens", "cached_input_tokens", "reasoning_output_tokens"];
const DEFAULT_JSONL_LIMITS = Object.freeze({ bytes: 4_000_000, events: 10_000, lineChars: 1_000_000 });

function sanitizedEnvironment(source) {
  return Object.fromEntries(Object.entries(source).filter(([name]) => !/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|COOKIE|AUTH)/i.test(name)));
}

function renderArgument(argument, { prompt, worktree, jobId }) {
  return argument
    .replaceAll("$PROMPTHUB_PROMPT", prompt)
    .replaceAll("$PROMPTHUB_WORKTREE", worktree)
    .replaceAll("$PROMPTHUB_JOB_ID", jobId);
}

function parseJsonlEvent(line) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return { invalid: true };
  }
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string") return { invalid: true, type: null };
  if (event.type !== "turn.completed") return { invalid: false, type: event.type, usage: null };
  if (Object.keys(event).some((field) => !["type", "usage"].includes(field))) return { invalid: true };
  if (!event.usage || typeof event.usage !== "object" || Array.isArray(event.usage)) return { invalid: true };
  const usage = {};
  for (const field of ["input_tokens", "output_tokens"]) {
    if (!Number.isSafeInteger(event.usage[field]) || event.usage[field] < 0) return { invalid: true };
  }
  if (Object.keys(event.usage).some((field) => !USAGE_FIELDS.includes(field))) return { invalid: true };
  for (const field of USAGE_FIELDS) {
    if (!Object.hasOwn(event.usage, field)) continue;
    const value = event.usage[field];
    if (!Number.isSafeInteger(value) || value < 0) return { invalid: true };
    usage[field] = value;
  }
  return { invalid: false, type: event.type, usage };
}

function checkedJsonlLimit(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export class ProcessExecutor {
  constructor({ executable = "", args = [], spawnImpl = nodeSpawn, environment = process.env, maxOutputBytes = 4000, maxJsonlBytes = DEFAULT_JSONL_LIMITS.bytes, maxJsonlEvents = DEFAULT_JSONL_LIMITS.events, maxJsonlLineChars = DEFAULT_JSONL_LIMITS.lineChars } = {}) {
    this.executable = executable;
    this.args = args;
    this.spawnImpl = spawnImpl;
    this.environment = environment;
    this.maxOutputBytes = maxOutputBytes;
    this.maxJsonlBytes = checkedJsonlLimit(maxJsonlBytes, "maxJsonlBytes", DEFAULT_JSONL_LIMITS.bytes);
    this.maxJsonlEvents = checkedJsonlLimit(maxJsonlEvents, "maxJsonlEvents", DEFAULT_JSONL_LIMITS.events);
    this.maxJsonlLineChars = checkedJsonlLimit(maxJsonlLineChars, "maxJsonlLineChars", DEFAULT_JSONL_LIMITS.lineChars);
  }

  run({ prompt, worktree, jobId, signal, onOutput } = {}) {
    if (!this.executable) throw new Error("CODEX_EXECUTABLE is not configured");
    if (!this.args.some((argument) => argument.includes("$PROMPTHUB_PROMPT"))) throw new Error("Codex executor arguments must contain $PROMPTHUB_PROMPT");
    const args = this.args.map((argument) => renderArgument(argument, { prompt, worktree, jobId }));
    const structuredOutput = this.args.includes("--json");
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = this.spawnImpl(this.executable, args, {
          cwd: worktree,
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: sanitizedEnvironment(this.environment),
        });
      } catch (error) {
        reject(error);
        return;
      }
      let captured = "";
      let settled = false;
      const stdoutDecoder = new TextDecoder("utf-8", { fatal: true });
      let usageEvent = null;
      let usageEventCount = 0;
      let jsonlEventCount = 0;
      let jsonlByteCount = 0;
      let telemetryIncomplete = false;
      let processReportedFailure = false;
      let discardStructuredOutput = false;
      let stdoutLine = "";
      let discardingOversizedLine = false;
      const capture = (chunk) => {
        const text = String(chunk);
        captured = `${captured}${text}`.slice(-this.maxOutputBytes);
        onOutput?.(text);
      };
      const processJsonLine = (line) => {
        jsonlEventCount += 1;
        if (jsonlEventCount > this.maxJsonlEvents || line.length > this.maxJsonlLineChars) {
          telemetryIncomplete = true;
          discardStructuredOutput = true;
          return;
        }
        const parsed = parseJsonlEvent(line.replace(/\r$/, ""));
        if (parsed.invalid) {
          telemetryIncomplete = true;
          discardStructuredOutput = true;
          return;
        }
        if (["error", "turn.failed"].includes(parsed.type)) processReportedFailure = true;
        if (parsed.usage) {
          usageEventCount += 1;
          if (usageEventCount > 1) {
            telemetryIncomplete = true;
            discardStructuredOutput = true;
            return;
          }
          usageEvent = parsed.usage;
        }
      };
      const parseStructuredOutput = (chunk) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        jsonlByteCount += bytes.byteLength;
        if (jsonlByteCount > this.maxJsonlBytes) {
          telemetryIncomplete = true;
          discardStructuredOutput = true;
          stdoutLine = "";
          return;
        }
        if (discardStructuredOutput) return;
        try {
          stdoutLine += stdoutDecoder.decode(bytes, { stream: true });
        } catch {
          telemetryIncomplete = true;
          discardStructuredOutput = true;
          stdoutLine = "";
          return;
        }
        while (true) {
          if (discardStructuredOutput) {
            stdoutLine = "";
            return;
          }
          if (discardingOversizedLine) {
            const newline = stdoutLine.indexOf("\n");
            if (newline < 0) {
              stdoutLine = "";
              return;
            }
            stdoutLine = stdoutLine.slice(newline + 1);
            discardingOversizedLine = false;
            continue;
          }
          const newline = stdoutLine.indexOf("\n");
          if (newline < 0) {
            if (stdoutLine.length > this.maxJsonlLineChars) {
              stdoutLine = "";
              discardingOversizedLine = true;
              telemetryIncomplete = true;
            }
            return;
          }
          processJsonLine(stdoutLine.slice(0, newline));
          stdoutLine = stdoutLine.slice(newline + 1);
        }
      };
      const finishStructuredOutput = () => {
        if (!discardStructuredOutput) {
          try {
            stdoutLine += stdoutDecoder.decode();
            if (!discardingOversizedLine && stdoutLine.length > 0) processJsonLine(stdoutLine);
          } catch {
            telemetryIncomplete = true;
            discardStructuredOutput = true;
          }
        }
        if (processReportedFailure) capture("Codex JSONL reported an execution failure event\n");
        if (telemetryIncomplete) capture("Codex JSONL token telemetry unavailable: stream incomplete or ambiguous\n");
        else if (usageEventCount !== 1) capture("Codex JSONL token telemetry unavailable: no usage event\n");
        stdoutLine = "";
      };
      child.stdout?.on("data", structuredOutput ? parseStructuredOutput : capture);
      child.stderr?.on("data", capture);
      const abort = () => {
        if (!settled) child.kill?.();
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
      child.once("close", (code, closeSignal) => {
        if (settled) return;
        settled = true;
        if (structuredOutput) finishStructuredOutput();
        resolve({ ok: code === 0 && !signal?.aborted && !processReportedFailure, exitCode: code, signal: closeSignal, outputTail: captured.slice(-this.maxOutputBytes), usage: structuredOutput && !telemetryIncomplete ? usageEvent : null });
      });
    });
  }
}

export class ScriptedExecutor {
  constructor(results = [{ ok: true, exitCode: 0 }]) {
    this.results = results.slice();
    this.calls = [];
  }

  async run(input) {
    this.calls.push({ jobId: input.jobId, worktree: input.worktree, prompt: input.prompt });
    return this.results.length > 1 ? this.results.shift() : this.results[0];
  }
}
