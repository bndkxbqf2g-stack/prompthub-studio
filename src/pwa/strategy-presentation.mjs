function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function strategyApprovalGate(strategy, provider, projectId) {
  const deny = (reason) => ({ allowed: false, reason });
  if (strategy?.critical !== true || strategy.status !== "awaiting_approval") return deny("Für diese Bewertung ist keine kritische Freigabe offen.");
  if (provider !== "github") return deny("Kritische Freigaben sind nur mit einer angemeldeten GitHub-Sitzung möglich.");

  const evidence = strategy.evidence;
  if (!evidence || evidence.project_id !== projectId || strategy.project_id !== projectId || evidence.critical !== true || evidence.verified !== true || evidence.source !== "github_pull_request_and_actions_api") {
    return deny("Die projektgebundene GitHub-Evidenz ist ungültig.");
  }
  if (!Number.isSafeInteger(evidence.pull_request_number) || evidence.pull_request_number < 1 || !Number.isSafeInteger(evidence.workflow_run_id) || evidence.workflow_run_id < 1 || !/^[a-f0-9]{40}$/i.test(evidence.head_sha ?? "") || evidence.check_name !== "test" || !validTimestamp(evidence.check_completed_at) || !validTimestamp(evidence.run_completed_at)) {
    return deny("Der passende erfolgreiche Pflichtcheck ist nicht vollständig belegt.");
  }
  if (evidence.file_list_complete !== true || evidence.file_list_valid !== true || !Number.isSafeInteger(evidence.changed_file_count) || evidence.changed_file_count < 1) {
    return deny("Die Liste der geänderten Dateien ist unvollständig oder ungültig.");
  }
  if (evidence.review_list_complete !== true) return deny("Die GitHub-Review-Liste ist unvollständig.");

  const author = typeof evidence.pull_request_author === "string" ? evidence.pull_request_author.toLowerCase() : "";
  const proposer = typeof strategy.proposed_by === "string" ? strategy.proposed_by.toLowerCase() : "";
  const hasIndependentReviewer = Array.isArray(evidence.independent_reviewers)
    && evidence.independent_reviewers.some((review) => typeof review?.login === "string"
      && review.login.toLowerCase() !== author
      && review.login.toLowerCase() !== proposer
      && validTimestamp(review.reviewed_at));
  if (!author || !proposer || !hasIndependentReviewer) return deny("Ein unabhängiger APPROVED-Review desselben PR-Heads fehlt.");
  return { allowed: true, reason: "Die aktuellen Nachweise sind vollständig. Der Server prüft sie bei der Freigabe erneut." };
}

export function strategyStatusLabel(strategy) {
  if (strategy?.critical === true && strategy.status === "awaiting_approval") return "Kritisch · Freigabe ausstehend";
  if (strategy?.critical === true && strategy.status === "adopted") return "Kritisch · menschlich freigegeben";
  if (strategy?.critical === false && strategy.status === "adopted") return "CI-Nachweis gespeichert";
  return "Status unbekannt";
}
