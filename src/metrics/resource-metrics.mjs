export function summarizeResourceMetrics({ jobs = [], drafts = [] } = {}) {
  const completed = jobs.filter((job) => ["succeeded", "failed"].includes(job.status));
  const checks = completed.filter((job) => Array.isArray(job.required_checks?.names) && job.required_checks.names.length > 0);
  const passed = checks.filter((job) => job.required_checks.passed === true).length;
  const failedJobs = completed.filter((job) => job.status === "failed");
  const checkFailures = failedJobs.filter((job) => Array.isArray(job.required_checks?.names) && job.required_checks.names.length > 0 && job.required_checks.passed === false).length;
  const measuredRuntimeJobs = jobs.filter((job) => Number.isFinite(job.resource_metrics?.runtime_ms));
  const tokenRecords = [
    ...jobs.map((job) => job.resource_metrics?.token_usage),
    ...drafts.map((draft) => draft.resource_metrics?.token_usage),
  ].filter((usage) => (Number.isSafeInteger(usage?.input_tokens) && usage.input_tokens >= 0) || (Number.isSafeInteger(usage?.output_tokens) && usage.output_tokens >= 0));
  const tokenComplete = tokenRecords.every((usage) => Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0 && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0);
  const modelCallJobs = jobs.filter((job) => Number(job.resource_metrics?.executor_invocations) > 0);
  const modelCallRecords = modelCallJobs.filter((job) => Number.isSafeInteger(job.resource_metrics?.model_calls));
  const designerProviderCalls = drafts.reduce((sum, draft) => sum + (Number.isSafeInteger(draft.resource_metrics?.provider_requests) ? draft.resource_metrics.provider_requests : 0), 0);
  const analysisCacheHits = drafts.filter((draft) => ["hit", "coalesced"].includes(draft.analysis_cache?.status)).length;
  const fallbackAnalyses = drafts.filter((draft) => ["deterministic_fallback", "provider_fallback"].includes(draft.source)).length;
  const executorInvocations = jobs.reduce((sum, job) => sum + (Number.isSafeInteger(job.resource_metrics?.executor_invocations) ? job.resource_metrics.executor_invocations : 0), 0);
  const measuredTokenCalls = tokenRecords.length;
  const designerCallsWithoutTokens = drafts.reduce((sum, draft) => {
    const calls = Number.isSafeInteger(draft.resource_metrics?.provider_requests) ? draft.resource_metrics.provider_requests : 0;
    return sum + (draft.resource_metrics?.token_usage ? 0 : calls);
  }, 0);
  const codexExecutionsWithoutModelCounts = modelCallJobs.length - modelCallRecords.length;
  const knownModelCallsWithoutTokens = modelCallRecords.reduce((sum, job) => sum + (job.resource_metrics.model_calls > 0 && !job.resource_metrics.token_usage ? job.resource_metrics.model_calls : 0), 0);
  const unmeasuredTokenRequests = designerCallsWithoutTokens + knownModelCallsWithoutTokens;
  const hasUnknownCodexTokenUsage = codexExecutionsWithoutModelCounts > 0;
  return {
    observed: {
      executor_invocations: executorInvocations,
      active_jobs: jobs.filter((job) => job.status === "running").length,
      runtime_ms: measuredRuntimeJobs.reduce((sum, job) => sum + job.resource_metrics.runtime_ms, 0),
      retries: jobs.reduce((sum, job) => sum + (Number.isInteger(job.resource_metrics?.retries) ? job.resource_metrics.retries : 0), 0),
      designer_provider_calls: designerProviderCalls,
      redundant_provider_requests_avoided: analysisCacheHits,
      fallback_analyses: fallbackAnalyses,
      codex_model_calls: modelCallJobs.length === 0
        ? { status: "not_available", value: null }
        : modelCallJobs.length === modelCallRecords.length
        ? { status: "measured", value: modelCallRecords.reduce((sum, job) => sum + job.resource_metrics.model_calls, 0) }
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
          status: tokenComplete && unmeasuredTokenRequests === 0 && !hasUnknownCodexTokenUsage ? "measured" : "partial",
          input_tokens: tokenRecords.reduce((sum, usage) => sum + (Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0 ? usage.input_tokens : 0), 0),
          output_tokens: tokenRecords.reduce((sum, usage) => sum + (Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0 ? usage.output_tokens : 0), 0),
          measured_requests: measuredTokenCalls,
          requests_without_measurement: unmeasuredTokenRequests,
          codex_executions_without_model_call_count: codexExecutionsWithoutModelCounts,
        }
      : { status: "not_available", input_tokens: null, output_tokens: null, measured_requests: 0, requests_without_measurement: unmeasuredTokenRequests, codex_executions_without_model_call_count: codexExecutionsWithoutModelCounts },
    quality: { source: "required_checks_and_terminal_job_status", passed_jobs: passed, checked_jobs: checks.length, failed_jobs: failedJobs.length, check_failure_jobs: checkFailures },
    notes: [
      "Token values are shown only when returned by the execution provider.",
      "Executor starts, runtime and retries are observed operational metrics, not model-call or token estimates.",
      "A passing test result does not by itself prove product quality or deployment readiness.",
    ],
  };
}
