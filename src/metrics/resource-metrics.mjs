import { TOKEN_USAGE_SOURCES } from "./token-usage.mjs";

function sumSafeIntegers(records, select) {
  let total = 0;
  let invalid = false;
  for (const record of records) {
    const value = select(record);
    if (value === undefined || value === null) continue;
    if (!Number.isSafeInteger(value) || value < 0) {
      invalid = true;
      continue;
    }
    const next = total + value;
    if (!Number.isSafeInteger(next)) {
      invalid = true;
      continue;
    }
    total = next;
  }
  return invalid ? null : total;
}

function hasMeasuredTokenUsage(usage) {
  return TOKEN_USAGE_SOURCES.includes(usage?.source)
    && ((Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0)
      || (Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0));
}

export function summarizeResourceMetrics({ jobs = [], drafts = [] } = {}) {
  const completed = jobs.filter((job) => ["succeeded", "failed"].includes(job.status));
  const checks = completed.filter((job) => Array.isArray(job.required_checks?.names) && job.required_checks.names.length > 0);
  const passed = checks.filter((job) => job.required_checks.passed === true).length;
  const failedJobs = completed.filter((job) => job.status === "failed");
  const checkFailures = failedJobs.filter((job) => Array.isArray(job.required_checks?.names) && job.required_checks.names.length > 0 && job.required_checks.passed === false).length;
  const tokenRecords = [
    ...jobs.map((job) => job.resource_metrics?.token_usage),
    ...drafts.map((draft) => draft.resource_metrics?.token_usage),
  ].filter(hasMeasuredTokenUsage);
  const sumTokenField = (field, { requireComplete = false } = {}) => {
    let sum = 0;
    let found = false;
    let complete = true;
    for (const usage of tokenRecords) {
      const value = usage[field];
      if (!Number.isSafeInteger(value) || value < 0) {
        complete = false;
        continue;
      }
      found = true;
      const next = sum + value;
      if (!Number.isSafeInteger(next)) return { value: null, complete: false };
      sum = next;
    }
    return { value: found && (!requireComplete || complete) ? sum : null, complete: found && complete };
  };
  const inputTokenTotal = sumTokenField("input_tokens");
  const outputTokenTotal = sumTokenField("output_tokens");
  const tokenComplete = inputTokenTotal.complete && outputTokenTotal.complete;
  const hasInvalidExecutorCounts = jobs.some((job) => job.resource_metrics?.executor_invocations !== undefined
    && job.resource_metrics?.executor_invocations !== null
    && (!Number.isSafeInteger(job.resource_metrics.executor_invocations) || job.resource_metrics.executor_invocations < 0));
  const modelCallRecords = jobs.filter((job) => Number.isSafeInteger(job.resource_metrics?.model_calls) && job.resource_metrics.model_calls >= 0);
  const modelCallCandidates = jobs.filter((job) => job.resource_metrics?.model_calls !== undefined && job.resource_metrics?.model_calls !== null);
  const hasInvalidModelCallCounts = modelCallCandidates.some((job) => !Number.isSafeInteger(job.resource_metrics.model_calls) || job.resource_metrics.model_calls < 0);
  const modelCallTotal = sumSafeIntegers(modelCallRecords, (job) => job.resource_metrics.model_calls);
  const designerProviderCalls = sumSafeIntegers(drafts, (draft) => draft.resource_metrics?.provider_requests);
  const analysisCacheHits = drafts.filter((draft) => ["hit", "coalesced"].includes(draft.analysis_cache?.status)).length;
  const fallbackAnalyses = drafts.filter((draft) => ["deterministic_fallback", "provider_fallback"].includes(draft.source)).length;
  const executorInvocations = sumSafeIntegers(jobs, (job) => job.resource_metrics?.executor_invocations);
  const runtimeMs = sumSafeIntegers(jobs, (job) => job.resource_metrics?.runtime_ms);
  const retries = sumSafeIntegers(jobs, (job) => job.resource_metrics?.retries);
  const measuredTokenCalls = tokenRecords.length;
  const cachedInputTokenTotal = sumTokenField("cached_input_tokens", { requireComplete: true }).value;
  const reasoningOutputTokenTotal = sumTokenField("reasoning_output_tokens", { requireComplete: true }).value;
  const designerCallsWithoutTokens = sumSafeIntegers(drafts.filter((draft) => !hasMeasuredTokenUsage(draft.resource_metrics?.token_usage)), (draft) => draft.resource_metrics?.provider_requests);
  const codexExecutionsWithoutModelCounts = jobs.filter((job) => Number.isSafeInteger(job.resource_metrics?.executor_invocations) && job.resource_metrics.executor_invocations > 0 && !Number.isSafeInteger(job.resource_metrics?.model_calls)).length;
  const knownModelCallsWithoutTokens = sumSafeIntegers(modelCallRecords.filter((job) => job.resource_metrics.model_calls > 0 && !hasMeasuredTokenUsage(job.resource_metrics.token_usage)), (job) => job.resource_metrics.model_calls);
  const unmeasuredTokenRequests = designerCallsWithoutTokens === null || knownModelCallsWithoutTokens === null
    ? null
    : sumSafeIntegers([designerCallsWithoutTokens, knownModelCallsWithoutTokens], (value) => value);
  const hasInvalidProviderCounts = drafts.some((draft) => draft.resource_metrics?.provider_requests !== undefined
    && draft.resource_metrics?.provider_requests !== null
    && (!Number.isSafeInteger(draft.resource_metrics.provider_requests) || draft.resource_metrics.provider_requests < 0));
  const hasUnknownTokenRequestCount = codexExecutionsWithoutModelCounts > 0 || hasInvalidExecutorCounts || hasInvalidProviderCounts;
  return {
    observed: {
      executor_invocations: executorInvocations,
      active_jobs: jobs.filter((job) => job.status === "running").length,
      runtime_ms: runtimeMs,
      retries,
      designer_provider_calls: designerProviderCalls,
      redundant_provider_requests_avoided: analysisCacheHits,
      fallback_analyses: fallbackAnalyses,
      codex_model_calls: modelCallCandidates.length === 0
        ? { status: "not_available", value: null }
        : !hasInvalidExecutorCounts && !hasInvalidModelCallCounts && modelCallCandidates.length === modelCallRecords.length && modelCallTotal !== null
        ? { status: "measured", value: modelCallTotal }
        : { status: "not_available", value: null },
      test_jobs: checks.length,
      test_jobs_passed: passed,
      test_pass_rate: checks.length ? passed / checks.length : null,
      completed_jobs: completed.length,
      failed_jobs: failedJobs.length,
      failed_job_rate: completed.length ? failedJobs.length / completed.length : null,
      check_failure_jobs: checkFailures,
    },
    tokens: tokenRecords.length
      ? {
          status: tokenComplete && unmeasuredTokenRequests === 0 && !hasUnknownTokenRequestCount ? "measured" : "partial",
          input_tokens: inputTokenTotal.value,
          output_tokens: outputTokenTotal.value,
          cached_input_tokens: cachedInputTokenTotal,
          reasoning_output_tokens: reasoningOutputTokenTotal,
          measured_requests: measuredTokenCalls,
          requests_without_measurement: unmeasuredTokenRequests,
          codex_executions_without_model_call_count: codexExecutionsWithoutModelCounts,
        }
      : { status: "not_available", input_tokens: null, output_tokens: null, cached_input_tokens: null, reasoning_output_tokens: null, measured_requests: 0, requests_without_measurement: unmeasuredTokenRequests, codex_executions_without_model_call_count: codexExecutionsWithoutModelCounts },
    quality: { source: "required_checks_and_terminal_job_status", passed_jobs: passed, checked_jobs: checks.length, failed_jobs: failedJobs.length, check_failure_jobs: checkFailures },
    notes: [
      "Token values require an allowlisted provider source and a valid provider-reported usage payload.",
      "Executor starts, runtime and retries are observed operational metrics; invalid or overflowing totals are unavailable.",
      "A passing test result does not by itself prove product quality or deployment readiness.",
    ],
  };
}
