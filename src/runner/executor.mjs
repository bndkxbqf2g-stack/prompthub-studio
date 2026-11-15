import process from "node:process";
import { spawn as nodeSpawn } from "node:child_process";

function sanitizedEnvironment(source) {
  return Object.fromEntries(Object.entries(source).filter(([name]) => !/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|COOKIE|AUTH)/i.test(name)));
}

function renderArgument(argument, { prompt, worktree, jobId }) {
  return argument
    .replaceAll("$PROMPTHUB_PROMPT", prompt)
    .replaceAll("$PROMPTHUB_WORKTREE", worktree)
    .replaceAll("$PROMPTHUB_JOB_ID", jobId);
}

export class ProcessExecutor {
  constructor({ executable = "", args = [], spawnImpl = nodeSpawn, environment = process.env, maxOutputBytes = 4000 } = {}) {
    this.executable = executable;
    this.args = args;
    this.spawnImpl = spawnImpl;
    this.environment = environment;
    this.maxOutputBytes = maxOutputBytes;
  }

  run({ prompt, worktree, jobId, signal, onOutput } = {}) {
    if (!this.executable) throw new Error("CODEX_EXECUTABLE is not configured");
    if (!this.args.some((argument) => argument.includes("$PROMPTHUB_PROMPT"))) throw new Error("Codex executor arguments must contain $PROMPTHUB_PROMPT");
    const args = this.args.map((argument) => renderArgument(argument, { prompt, worktree, jobId }));
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
      const capture = (chunk) => {
        const text = String(chunk);
        captured = `${captured}${text}`.slice(-this.maxOutputBytes);
        onOutput?.(text);
      };
      child.stdout?.on("data", capture);
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
        resolve({ ok: code === 0 && !signal?.aborted, exitCode: code, signal: closeSignal, outputTail: captured.slice(-this.maxOutputBytes) });
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
