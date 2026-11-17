import { runRequiredChecks } from "./checks.mjs";
import { normalizeTokenUsage } from "../metrics/token-usage.mjs";
import { classifyFailurePatterns, FAILURE_PATTERN_NAMES } from "../knowledge/failure-classifier.mjs";
import { randomUUID } from "node:crypto";

function wait(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export class PromptHubRunner {
  constructor({ controlPlane, executor, worktrees, checkRunner = runRequiredChecks, outcomeRecorder = null, config, runnerId = config?.runner?.id ?? "runner", runnerInstanceId = randomUUID(), clock = () => new Date(), logger = console } = {}) {
    if (!controlPlane || !executor || !worktrees || !config) throw new Error("controlPlane, executor, worktrees and config are required");
    this.controlPlane = controlPlane;
    this.executor = executor;
    this.worktrees = worktrees;
    this.checkRunner = checkRunner;
    this.outcomeRecorder = outcomeRecorder;
    this.config = config;
    this.runnerId = `${runnerId}:${runnerInstanceId}`;
    this.clock = clock;
    this.logger = logger;
    this.stopController = new AbortController();
    this.current = null;
  }

  async recordOutcome(jobId) {
    if (typeof this.outcomeRecorder?.recordVerifiedJobOutcome !== "function") return;
    try {
      const result = await this.outcomeRecorder.recordVerifiedJobOutcome(jobId);
      this.logger.info?.({ event: "verified_outcome_recorded", job_id: jobId, created: result?.created === true });
    } catch (error) {
      this.logger.error?.({ event: "verified_outcome_persist_failed", job_id: jobId, error_class: error?.name ?? "Error" });
    }
  }

  stop() {
    this.stopController.abort();
    this.current?.controller.abort();
  }

  async runOnce() {
    await this.controlPlane.recoverStaleJobs?.();
    const queued = await this.controlPlane.listQueuedJobs();
    const results = [];
    for (const job of queued) {
      if (this.stopController.signal.aborted) break;
      const claimed = await this.controlPlane.claimJob(job.id, this.runnerId);
      if (!claimed) {
        results.push({ jobId: job.id, status: "not_claimed" });
        continue;
      }
      results.push(await this.processClaimed(claimed));
      break;
    }
    return results;
  }

  async processClaimed(job) {
    const startedAt = this.clock().getTime();
    const leaseGeneration = job.lease_generation ?? null;
    const controller = new AbortController();
    this.current = { jobId: job.id, controller };
    let heartbeatTimer;
    let terminal = false;
    let executorInvocations = 0;
    let retries = 0;
    let executionMetrics = { token_usage: null, model_calls: null };
    const markFailed = async (summary, phase = "runner", failureInfo = null) => {
      if (terminal) return;
      try {
        await this.controlPlane.checkpoint(job.id, this.runnerId, { phase, summary }, leaseGeneration);
        await this.controlPlane.completeJob(job.id, this.runnerId, "failed", {
          requiredChecks: {
            passed: false,
            names: Array.isArray(failureInfo?.names) ? failureInfo.names.slice(0, 30) : [],
            failure_patterns: Array.isArray(failureInfo?.failure_patterns) && failureInfo.failure_patterns.every((name) => FAILURE_PATTERN_NAMES.includes(name))
              ? [...new Set(failureInfo.failure_patterns)].slice(0, 8)
              : classifyFailurePatterns(failureInfo?.outputTail),
          },
          resourceMetrics: { runtime_ms: Math.max(0, this.clock().getTime() - startedAt), executor_invocations: executorInvocations, retries, ...executionMetrics },
        }, leaseGeneration);
        terminal = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        await this.recordOutcome(job.id);
      } catch (error) {
        this.logger.error?.({ event: "job_terminal_update_failed", job_id: job.id, error_class: error?.name ?? "Error" });
      }
    };
    try {
      heartbeatTimer = setInterval(() => {
        this.controlPlane.heartbeat(job.id, this.runnerId, "running", leaseGeneration).catch((error) => {
          this.logger.error?.({ event: "heartbeat_failed", job_id: job.id, error_class: error?.name ?? "Error" });
          controller.abort();
        });
      }, this.config.runner.heartbeatMs);
      await this.controlPlane.checkpoint(job.id, this.runnerId, { phase: "claimed", summary: "Job claimed; preparing isolated worktree" }, leaseGeneration);
      const worktree = await this.worktrees.prepare(job);
      await this.controlPlane.checkpoint(job.id, this.runnerId, { phase: worktree.resumed ? "resume" : "worktree", summary: worktree.resumed ? "Resuming from existing worktree" : "Isolated worktree prepared", ref: worktree.path }, leaseGeneration);
      executorInvocations += 1;
      const execution = await this.executor.run({ prompt: job.prompt, worktree: worktree.path, jobId: job.id, signal: controller.signal });
      executionMetrics = {
        token_usage: normalizeTokenUsage(execution.usage, "execution_provider"),
        model_calls: Number.isSafeInteger(execution.modelCalls) ? execution.modelCalls : null,
      };
      if (!execution.ok) {
        await markFailed(`Executor ended without success (exit ${execution.exitCode ?? "unknown"})`, "execute", { outputTail: execution.outputTail });
        return { jobId: job.id, status: "failed" };
      }
      await this.controlPlane.checkpoint(job.id, this.runnerId, { phase: "checks", summary: "Executor completed; running required checks" }, leaseGeneration);
      const checks = await this.checkRunner({ worktree: worktree.path, job, commands: this.config.runner.requiredCommands, signal: controller.signal, logger: this.logger });
      if (checks.passed !== true) {
        await markFailed(`Required check failed: ${checks.failed ?? "unknown"}`, "checks", checks);
        return { jobId: job.id, status: "failed" };
      }
      await this.controlPlane.checkpoint(job.id, this.runnerId, { phase: "result", summary: "All required checks passed", ref: checks.names.join(",") }, leaseGeneration);
      await this.controlPlane.completeJob(job.id, this.runnerId, "succeeded", {
        requiredChecks: { passed: true, names: checks.names },
        resourceMetrics: {
          runtime_ms: Math.max(0, this.clock().getTime() - startedAt),
          executor_invocations: executorInvocations,
          retries,
          ...executionMetrics,
        },
      }, leaseGeneration);
      terminal = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      await this.recordOutcome(job.id);
      return { jobId: job.id, status: "succeeded" };
    } catch (error) {
      await markFailed(`Runner stopped in a controlled state (${error?.name ?? "Error"})`, "runner");
      return { jobId: job.id, status: "failed" };
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      this.current = null;
    }
  }

  async runLoop({ signal = this.stopController.signal } = {}) {
    while (!signal.aborted) {
      try {
        await this.runOnce();
      } catch (error) {
        this.logger.error?.({ event: "runner_poll_failed", error_class: error?.name ?? "Error" });
      }
      await wait(this.config.runner.pollMs, signal);
    }
  }
}
