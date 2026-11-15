import { spawn as nodeSpawn } from "node:child_process";
import { classifyFailurePatterns } from "../knowledge/failure-classifier.mjs";

function execute(command, { cwd, spawnImpl = nodeSpawn, signal, maxOutputBytes = 2000 } = {}) {
  const [executable, ...args] = command;
  return new Promise((resolve, reject) => {
    const child = spawnImpl(executable, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const capture = (chunk) => { output = `${output}${String(chunk)}`.slice(-maxOutputBytes); };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    const abort = () => child.kill?.();
    if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
    child.once("error", reject);
    child.once("close", (code, closeSignal) => resolve({ passed: code === 0 && !signal?.aborted, exitCode: code, signal: closeSignal, outputTail: output }));
  });
}

export async function runRequiredChecks({ worktree, commands, spawnImpl = nodeSpawn, signal, logger = console } = {}) {
  const names = [];
  for (const command of commands) {
    const result = await execute(command, { cwd: worktree, spawnImpl, signal });
    const name = command.join(" ");
    names.push(name);
    logger.info?.({ event: "required_check", check: name, passed: result.passed, exit_code: result.exitCode });
    if (!result.passed) return { passed: false, names, failed: name, failure_patterns: classifyFailurePatterns(result.outputTail) };
  }
  return { passed: true, names };
}
