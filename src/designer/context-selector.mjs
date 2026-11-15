const STOP_WORDS = new Set([
  "about", "after", "also", "and", "auf", "aus", "before", "between", "das", "dass", "der", "die", "dies", "ein", "eine", "einer", "eines", "für", "from", "have", "into", "mit", "more", "nach", "oder", "only", "that", "the", "this", "und", "use", "with", "wird", "will", "werden", "when", "which", "with",
]);
const PROTECTED_RULE = /\b(test|tests|testing|ci|security|sicher|auth|permission|berechtig|secret|geheim|approval|freigabe|migration|production|produkt|privacy|datenschutz|backup|rollback|pflicht|no\s+merge)\b/i;

function terms(value) {
  return [...new Set(String(value ?? "").normalize("NFKC").toLocaleLowerCase("und").match(/[\p{L}\p{N}]{3,}/gu) ?? [])]
    .filter((term) => !STOP_WORDS.has(term));
}

function overlap(line, keywords) {
  const normalized = line.normalize("NFKC").toLocaleLowerCase("und");
  return keywords.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function selectExcerpt(source, query, { maxChars, protectedRules = false } = {}) {
  if (typeof source !== "string" || !source.trim()) return "";
  const keywords = terms(query);
  const lines = source.split(/\r?\n/);
  const ranked = lines.map((line, index) => {
    const matchScore = overlap(line, keywords);
    const protectedScore = protectedRules && PROTECTED_RULE.test(line) ? 2 : 0;
    return { index, line: line.trim(), score: matchScore + protectedScore, matchScore };
  }).filter((item) => item.line);
  let chosen = ranked.filter((item) => item.score > 0);
  if (chosen.length === 0) chosen = ranked.slice(0, 12);
  const selected = new Set(chosen.map((item) => item.index));
  for (const item of chosen) {
    const previous = lines[item.index - 1]?.trim();
    if (previous && /^#{1,6}\s/.test(previous)) selected.add(item.index - 1);
  }
  const ordered = [...selected].sort((a, b) => a - b);
  const result = [];
  let size = 0;
  for (const index of ordered) {
    const line = `[L${index + 1}] ${lines[index].trim()}`;
    if (size + line.length + 1 > maxChars) continue;
    result.push(line);
    size += line.length + 1;
  }
  return result.join("\n");
}

export function selectProjectContext(project, query) {
  const analysis = project?.analysis ?? {};
  const readme = selectExcerpt(analysis.readme_summary, query, { maxChars: 2200 });
  const projectRules = selectExcerpt(analysis.project_rules, query, { maxChars: 3600, protectedRules: true });
  const keywords = terms(query);
  const issues = (analysis.open_issues ?? []).map((issue) => ({
    issue,
    score: overlap(`${issue.title ?? ""} ${(issue.labels ?? []).join(" ")}`, keywords),
  })).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.issue.number - b.issue.number)
    .slice(0, 5)
    .map(({ issue }) => ({ number: issue.number, title: String(issue.title ?? "").slice(0, 200) }));
  const verifiedOutcomes = (project?.verified_outcomes ?? [])
    .filter((item) => item?.verified === true && item.project_id === project?.id && item.source === "control_plane_completion_event")
    .slice(0, 5)
    .map((item) => ({
      job_status: item.job_status,
      outcome: item.outcome,
      evidence_level: item.evidence_level,
      failure_stage: item.failure_stage,
      completed_at: item.completed_at,
      required_checks: {
        passed: item.required_checks?.passed === true,
        names: Array.isArray(item.required_checks?.names) ? item.required_checks.names.slice(0, 5).map((name) => String(name).slice(0, 120)) : [],
      },
      resource_metrics: Object.fromEntries(["runtime_ms", "retries", "executor_invocations", "model_calls"].flatMap((key) => Number.isSafeInteger(item.resource_metrics?.[key]) && item.resource_metrics[key] >= 0 ? [[key, item.resource_metrics[key]]] : [])),
    }));
  const recentCi = (analysis.recent_ci ?? []).slice(0, 3).map((run) => ({
    name: String(run.name ?? "workflow").slice(0, 120),
    status: String(run.status ?? "unknown").slice(0, 40),
    conclusion: String(run.conclusion ?? "unknown").slice(0, 40),
    updated_at: String(run.updated_at ?? "").slice(0, 40),
    failure_detail_status: run.failure_detail_status ?? "unavailable",
    failed_jobs: (run.failed_jobs ?? []).slice(0, 5).map((job) => ({
      name: String(job.name ?? "job").slice(0, 120),
      failed_steps: (job.failed_steps ?? []).slice(0, 5).map((name) => String(name).slice(0, 120)),
    })),
  }));
  const errorSignals = (project?.error_signals ?? []).slice(0, 5).map((item) => ({
    source: item.source,
    symptom: {
      category: item.symptom?.category,
      summary: typeof item.symptom?.summary === "string" ? item.symptom.summary.slice(0, 800) : null,
      failure_stage: item.symptom?.failure_stage ?? null,
      check_names: Array.isArray(item.symptom?.check_names) ? item.symptom.check_names.slice(0, 10).map((name) => String(name).slice(0, 120)) : [],
      failure_patterns: Array.isArray(item.symptom?.failure_patterns) ? item.symptom.failure_patterns.slice(0, 8) : [],
    },
    components: (item.components ?? []).slice(0, 10),
    cause_status: item.cause_status,
    hypotheses: item.cause_status !== "human_confirmed" ? (item.hypotheses ?? []).slice(0, 3).map((hypothesis) => ({ summary: hypothesis.summary.slice(0, 800), approach: hypothesis.approach?.slice(0, 500) ?? "", status: "hypothesis" })) : [],
    confirmed_cause: item.cause_status === "human_confirmed" ? {
      summary: item.confirmed_cause.summary.slice(0, 800),
      same_change_verified: item.confirmed_cause.same_change_verified === true,
      ineffective_approach: item.confirmed_cause.ineffective_approach?.slice(0, 500) ?? null,
      regression_checks: item.confirmed_cause.regression_checks.slice(0, 10),
      evidence_job_ids: item.confirmed_cause.evidence_job_ids,
    } : null,
    occurrence_count: item.occurrence_count,
    verified_evidence_available: item.verified_evidence_available === true,
  }));
  return {
    summary_schema_version: analysis.summary_schema_version ?? null,
    snapshot_version: analysis.snapshot_version ?? null,
    source_refs: analysis.source_refs ?? {},
    readme,
    project_rules: projectRules,
    relevant_issues: issues,
    verified_outcomes: verifiedOutcomes,
    recent_ci: recentCi,
    error_signals: errorSignals,
    selected_characters: readme.length + projectRules.length + issues.reduce((sum, item) => sum + item.title.length, 0) + JSON.stringify(verifiedOutcomes).length + JSON.stringify(recentCi).length + JSON.stringify(errorSignals).length,
    selection: "task-relevance with protected test/security rules",
  };
}
