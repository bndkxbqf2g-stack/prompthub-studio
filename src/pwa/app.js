const state = {
  user: null,
  projects: [],
  selectedProject: null,
  incidents: [],
  jobs: [],
  draft: null,
  attachments: [],
  library: [],
  favorites: new Set(),
  libraryReviews: new Map(),
};

const el = (selector) => document.querySelector(selector);
const elements = {
  notice: el("#notice"), authPanel: el("#auth-panel"), appPanel: el("#app-panel"), userLabel: el("#user-label"),
  projects: el("#projects"), projectForm: el("#project-form"), projectDetail: el("#project-detail"),
  incidentPanel: el("#incident-panel"), incidentReportForm: el("#incident-report-form"), incidentSummary: el("#incident-summary"), incidentComponents: el("#incident-components"), incidents: el("#incidents"),
  designerForm: el("#designer-form"), draftView: el("#draft-view"), intent: el("#intent"),
  jobs: el("#jobs"), jobCount: el("#job-count"), metrics: el("#metrics"), jobCap: el("#job-cap"),
  librarySearch: el("#library-search"), libraryCategory: el("#library-category"), libraryResults: el("#library-results"),
  dialog: el("#confirmation-dialog"), dialogTitle: el("#confirmation-title"), dialogDescription: el("#confirmation-description"),
  dialogLabel: el("#confirmation-label"), dialogInput: el("#confirmation-value"), dialogError: el("#confirmation-error"),
};

function notice(message = "", kind = "") {
  elements.notice.textContent = message;
  elements.notice.className = `notice ${kind}`.trim();
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "request_failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function button(label, className, onClick) {
  const result = document.createElement("button");
  result.type = "button";
  result.className = `button ${className ?? "secondary"}`.trim();
  result.textContent = label;
  result.addEventListener("click", onClick);
  return result;
}

function statusLabel(status) {
  return ({ queued: "Wartend", running: "Läuft", awaiting_approval: "Freigabe nötig", succeeded: "Erfolgreich", failed: "Fehlgeschlagen", paused: "Pausiert", stale: "Prüfung nötig" })[status] ?? "Unbekannt";
}

function addText(parent, tagName, text, className = "") {
  const node = document.createElement(tagName);
  node.textContent = text ?? "";
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function renderProjects() {
  elements.projects.replaceChildren();
  if (!state.projects.length) {
    addText(elements.projects, "p", "Noch keine Projekte verbunden. Die Analyse liest GitHub-Daten, ohne das Repository zu verändern.", "empty");
    return;
  }
  for (const project of state.projects) {
    const card = document.createElement("article");
    card.className = `project-card ${state.selectedProject === project.id ? "selected" : ""}`;
    const heading = document.createElement("header");
    addText(heading, "h3", project.full_name);
    const stateChip = addText(heading, "span", project.status === "connected" ? "Verbunden" : "Entfernt", "chip");
    if (project.status === "removed") stateChip.classList.add("paused");
    card.append(heading);
    addText(card, "p", project.description || "Keine Repository-Beschreibung", "muted");
    const actions = document.createElement("div");
    actions.className = "job-actions";
    if (project.status === "connected") {
      actions.append(button("Öffnen", "secondary", () => selectProject(project.id)));
      actions.append(button("Aus PromptHub entfernen", "secondary", () => removeProject(project)));
    } else {
      actions.append(button("Erneut verbinden", "secondary", () => reconnectProject(project)));
      actions.append(button("Gespeicherte Projektdaten löschen …", "danger-outline", () => deleteProjectData(project)));
    }
    card.append(actions);
    elements.projects.append(card);
  }
}

function renderProjectDetail() {
  const project = state.projects.find((item) => item.id === state.selectedProject && item.status === "connected");
  elements.projectDetail.replaceChildren();
  elements.projectDetail.hidden = !project;
  elements.incidentPanel.hidden = !project;
  elements.designerForm.querySelector("button[type=submit]").disabled = !project;
  if (!project) return;
  const analysis = project.analysis ?? {};
  addText(elements.projectDetail, "h3", `${project.full_name} · ${project.default_branch}`);
  const summary = document.createElement("div");
  summary.className = "project-facts";
  addText(summary, "span", `${analysis.open_issues?.length ?? 0} offene Issues im Snapshot`, "chip");
  addText(summary, "span", `${analysis.workflows?.length ?? 0} CI-Workflows`, "chip");
  const latestCi = analysis.recent_ci?.[0];
  addText(summary, "span", latestCi ? `Letzter CI-Lauf: ${latestCi.conclusion ?? latestCi.status}` : "Kein CI-Lauf im Snapshot", "chip");
  elements.projectDetail.append(summary);
  const failedRun = (analysis.recent_ci ?? []).find((run) => run.conclusion === "failure");
  if (failedRun) {
    const failedSteps = (failedRun.failed_jobs ?? []).flatMap((job) => job.failed_steps ?? []);
    addText(elements.projectDetail, "p", `CI-Diagnose: ${failedRun.failed_jobs?.length ?? 0} fehlgeschlagene Jobs${failedSteps.length ? ` · Schritte: ${failedSteps.join(", ")}` : ` · Details ${failedRun.failure_detail_status === "inspected" ? "ohne fehlgeschlagene Einzelschritte" : "nicht verfügbar"}`}. Die Ursache ist damit nicht bestätigt.`, "muted");
    try {
      const linkUrl = new URL(failedRun.html_url);
      if (linkUrl.protocol === "https:" && linkUrl.hostname === "github.com") {
        const link = document.createElement("a");
        link.href = linkUrl.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Fehlerhaften CI-Lauf in GitHub prüfen";
        elements.projectDetail.append(link);
      }
    } catch { /* malformed external links are omitted */ }
  }
  if (analysis.project_rules) addText(elements.projectDetail, "p", `Projektregeln erkannt: ${analysis.project_rules.length} Zeichen · Quelle AGENTS.md`, "muted");
  if (analysis.scripts && Object.keys(analysis.scripts).length) addText(elements.projectDetail, "p", `Skripte: ${Object.keys(analysis.scripts).join(", ")}`, "muted");
  const snapshot = analysis.snapshot_version ? ` · Snapshot ${analysis.snapshot_version.slice(0, 12)} · Schema ${analysis.summary_schema_version ?? "?"}` : "";
  addText(elements.projectDetail, "p", `Nur-Lese-Analyse: ${new Date(analysis.analyzed_at).toLocaleString("de-DE")}${snapshot}`, "muted");
}

function renderIncidents() {
  elements.incidents.replaceChildren();
  if (!state.selectedProject) return;
  if (!state.incidents.length) return addText(elements.incidents, "p", "Für dieses Projekt sind noch keine Fehler oder Fehlerberichte erfasst.", "empty");
  for (const incident of state.incidents) {
    const card = document.createElement("article");
    card.className = "incident-card";
    const heading = document.createElement("header");
    addText(heading, "h4", incident.symptom.summary || `${incident.symptom.category} · ${incident.symptom.failure_stage ?? "Phase unbekannt"}`);
    addText(heading, "span", incident.cause_status === "human_confirmed" ? "Ursache bestätigt" : incident.cause_status === "hypothesis" ? "Hypothese" : "Ursache offen", `chip ${incident.cause_status === "human_confirmed" ? "succeeded" : "paused"}`);
    card.append(heading);
    addText(card, "p", `${incident.source === "runner_outcome" ? "Runner-Nachweis" : "Nutzerbericht"} · ${incident.occurrence_count} Vorkommen · Version ${incident.version} · ${new Date(incident.updated_at).toLocaleString("de-DE")}`, "muted");
    if (incident.symptom.check_names?.length) addText(card, "p", `Betroffene Pflichtchecks: ${incident.symptom.check_names.join(", ")}`);
    if (incident.symptom.failure_patterns?.length) addText(card, "p", `Deterministische Fehlerklassen aus der Ausgabeanalyse: ${incident.symptom.failure_patterns.join(", ")} · keine Ursache`, "muted");
    if (incident.components?.length) addText(card, "p", `Pfade: ${incident.components.join(", ")}`, "muted");
    if (incident.evidence_refs?.length) addText(card, "p", `Verknüpfte Jobs: ${incident.evidence_refs.map((item) => item.job_id).join(", ")}`, "muted");
    if (window.PromptHubRegressionTestRequest?.canPrepare(incident)) {
      card.append(button("Regressionstest-Auftrag vorbereiten", "secondary", () => {
        elements.intent.value = window.PromptHubRegressionTestRequest.build(incident, state.selectedProject);
        el("#designer-section").scrollIntoView({ behavior: "smooth", block: "start" });
        elements.intent.focus({ preventScroll: true });
        notice("Beleggestützter Regressionstest-Auftrag vorbereitet. Prüfe den Entwurf und gib ihn nur über den regulären Ablauf frei.", "success");
      }));
    }
    if (incident.confirmed_cause) {
      addText(card, "p", `Menschlich bestätigt: ${incident.confirmed_cause.summary}`, "recommendation");
      addText(card, "p", `Fehler-/Korrekturbeleg: ${incident.confirmed_cause.evidence_job_ids.join(" → ")} · Regressionchecks: ${incident.confirmed_cause.regression_checks.join(", ")}`, "muted");
      if (!incident.verified_evidence_available) addText(card, "p", "Die ursprünglichen Jobbelege liegen außerhalb des aktiven 200-Ergebnis-Speichers; vor einer erneuten Verwendung müssen sie in GitHub geprüft werden.", "error-text");
      if (incident.confirmed_cause.ineffective_approach) addText(card, "p", `Als ungeeignet markiert: ${incident.confirmed_cause.ineffective_approach}`, "muted");
    }
    for (const hypothesis of incident.hypotheses ?? []) {
      const label = hypothesis.status === "human_confirmed" ? "Bestätigte Ursache" : "Unbestätigte Hypothese";
      addText(card, "p", `${label}: ${hypothesis.summary}${hypothesis.approach ? ` · Ansatz: ${hypothesis.approach}` : ""}`, hypothesis.status === "human_confirmed" ? "recommendation" : "muted");
      if (hypothesis.status === "hypothesis") card.append(button("Ursache mit Fehl-/Erfolgsbeleg bestätigen …", "secondary", () => confirmIncidentCause(incident, hypothesis)));
    }
    if (incident.cause_status !== "human_confirmed") card.append(buildHypothesisForm(incident));
    elements.incidents.append(card);
  }
}

function buildHypothesisForm(incident) {
  const form = document.createElement("form");
  form.className = "hypothesis-form";
  addText(form, "h5", "Ursache als Hypothese ergänzen");
  const summary = document.createElement("textarea");
  summary.maxLength = 1500;
  summary.rows = 2;
  summary.required = true;
  summary.placeholder = "Vermutete Ursache (noch nicht bestätigt)";
  const approach = document.createElement("input");
  approach.maxLength = 800;
  approach.placeholder = "Bisher ungeeigneter Ansatz (optional)";
  const components = document.createElement("input");
  components.maxLength = 800;
  components.placeholder = "Betroffene Pfade (optional)";
  const evidence = document.createElement("input");
  evidence.maxLength = 1200;
  evidence.placeholder = "Verifizierte Job-IDs, kommasepariert (optional)";
  for (const [label, field] of [["Vermutete Ursache", summary], ["Ansatz", approach], ["Pfade", components], ["Belegjobs", evidence]]) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    wrapper.append(field);
    form.append(wrapper);
  }
  const submit = button("Hypothese speichern", "secondary", async () => {});
  submit.type = "submit";
  form.append(submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const paths = components.value.split(",").map((item) => item.trim()).filter(Boolean);
    const evidenceJobIds = evidence.value.split(",").map((item) => item.trim()).filter(Boolean);
    try {
      await request(`/api/projects/${encodeURIComponent(state.selectedProject)}/incidents/${encodeURIComponent(incident.id)}/hypotheses`, {
        method: "POST", body: JSON.stringify({ summary: summary.value, approach: approach.value, components: paths, evidenceJobIds }),
      });
      await Promise.all([loadIncidents(), loadMetrics()]);
      notice("Ursachenhypothese gespeichert und klar als unbestätigt markiert.", "success");
    } catch (error) { notice(error.message || "Hypothese konnte nicht gespeichert werden.", "error"); }
  });
  return form;
}

async function confirmIncidentCause(incident, hypothesis) {
  const fields = document.createElement("div");
  addText(fields, "p", "Die Bestätigung benötigt einen verifizierten fehlgeschlagenen Pflichtcheck und einen später bestandenen Lauf desselben Checks.");
  const failed = document.createElement("input");
  failed.placeholder = "Fehlgeschlagener Job: job_…";
  const corrected = document.createElement("input");
  corrected.placeholder = "Später erfolgreicher Job: job_…";
  const sameChange = document.createElement("input");
  sameChange.type = "checkbox";
  sameChange.required = true;
  const sameChangeLabel = document.createElement("label");
  sameChangeLabel.className = "checkbox-row";
  sameChangeLabel.append(sameChange, document.createTextNode("Ich habe geprüft, dass der spätere Job dieselbe Korrektur betrifft."));
  const ineffective = document.createElement("input");
  ineffective.type = "checkbox";
  const ineffectiveLabel = document.createElement("label");
  ineffectiveLabel.className = "checkbox-row";
  ineffectiveLabel.append(ineffective, document.createTextNode("Diesen Ansatz als nachweislich ungeeignet kennzeichnen"));
  fields.append(failed, corrected, sameChangeLabel, ineffectiveLabel);
  const expected = `CONFIRM CAUSE ${incident.id}`;
  const approved = await confirmation({ title: "Fehlerursache bestätigen?", description: fields, expected, label: `Nach Prüfung der Belege exakt „${expected}“ eingeben` });
  if (!approved) return;
  if (!sameChange.checked || !failed.value.trim() || !corrected.value.trim()) return notice("Für eine Ursachenbestätigung sind beide Job-IDs und die Prüfung derselben Korrektur erforderlich.", "error");
  try {
    await request(`/api/projects/${encodeURIComponent(state.selectedProject)}/incidents/${encodeURIComponent(incident.id)}/confirm`, {
      method: "POST", body: JSON.stringify({ hypothesisId: hypothesis.id, failedJobId: failed.value.trim(), correctedJobId: corrected.value.trim(), confirmation: expected, sameChangeVerified: sameChange.checked, markApproachIneffective: ineffective.checked }),
    });
    await Promise.all([loadIncidents(), loadMetrics()]);
    notice("Ursache mit menschlicher Freigabe und verifizierten Prüfergebnissen bestätigt.", "success");
  } catch (error) { notice(error.message || "Ursache konnte nicht bestätigt werden.", "error"); }
}

async function loadIncidents() {
  if (!state.selectedProject) { state.incidents = []; renderIncidents(); return; }
  try {
    const payload = await request(`/api/projects/${encodeURIComponent(state.selectedProject)}/incidents`);
    state.incidents = payload.incidents;
  } catch (error) {
    state.incidents = [];
    notice(error.message || "Fehlerhistorie konnte nicht geladen werden.", "error");
  }
  renderIncidents();
}

function selectProject(projectId) {
  state.selectedProject = projectId;
  state.draft = null;
  elements.draftView.hidden = true;
  renderProjects();
  renderProjectDetail();
  Promise.all([loadJobs(), loadIncidents()]).catch(() => notice("Projektansicht konnte nicht vollständig geladen werden.", "error"));
}

function confirmation({ title, description, expected, label }) {
  return new Promise((resolve) => {
    elements.dialogTitle.textContent = title;
    elements.dialogDescription.replaceChildren();
    if (typeof description === "string") addText(elements.dialogDescription, "p", description);
    else elements.dialogDescription.append(description);
    elements.dialogLabel.textContent = label;
    elements.dialogInput.value = "";
    elements.dialogError.textContent = "";
    const submit = el("#confirmation-submit");
    const cancel = el("#confirmation-cancel");
    const finish = (value) => {
      elements.dialog.close();
      submit.removeEventListener("click", onSubmit);
      cancel.removeEventListener("click", onCancel);
      resolve(value);
    };
    const onSubmit = () => {
      if (elements.dialogInput.value.trim() !== expected) {
        elements.dialogError.textContent = `Bitte exakt eingeben: ${expected}`;
        return;
      }
      finish(true);
    };
    const onCancel = () => finish(false);
    submit.addEventListener("click", onSubmit);
    cancel.addEventListener("click", onCancel);
    elements.dialog.addEventListener("cancel", () => finish(false), { once: true });
    elements.dialog.showModal();
    elements.dialogInput.focus();
  });
}

async function removeProject(project) {
  const { jobs = [] } = await request(`/api/jobs?project=${encodeURIComponent(project.id)}`).catch(() => ({ jobs: [] }));
  const active = jobs.filter((job) => ["queued", "awaiting_approval", "running", "stale"].includes(job.status));
  const description = document.createElement("div");
  addText(description, "p", `Diese Aktion trennt ${project.full_name} nur aus PromptHub. Das GitHub-Repository und seine Daten werden nicht verändert oder gelöscht.`);
  if (active.length) {
    addText(description, "p", "Auftragsprüfung:", "eyebrow");
    const list = document.createElement("ul");
    for (const job of active) addText(list, "li", `${job.id} · ${statusLabel(job.status)}${job.status === "queued" || job.status === "awaiting_approval" ? " · wird beim Trennen pausiert" : " · muss zuerst abgeschlossen oder geprüft pausiert werden"}`);
    description.append(list);
  }
  const expected = `REMOVE ${project.id}`;
  if (!await confirmation({ title: "Aus PromptHub entfernen?", description, expected, label: `Zur Bestätigung „${expected}“ eingeben` })) return;
  try {
    const result = await request(`/api/projects/${encodeURIComponent(project.id)}/remove`, { method: "POST", body: JSON.stringify({ confirmation: expected }) });
    if (!result.removed) {
      notice("Projekt bleibt verbunden: Laufende oder unklare Aufträge müssen erst abgeschlossen oder geprüft pausiert werden.", "error");
    } else {
      notice("Projekt aus PromptHub entfernt. Das GitHub-Repository ist unverändert.", "success");
    }
    await loadProjects();
    await loadMetrics();
  } catch {
    notice("Das Projekt konnte nicht entfernt werden. Der aktuelle Verknüpfungszustand wurde beibehalten.", "error");
  }
}

async function reconnectProject(project) {
  try {
    await request(`/api/projects/${encodeURIComponent(project.id)}/reconnect`, { method: "POST", body: "{}" });
    await loadProjects();
    selectProject(project.id);
    notice("Projekt erneut verbunden und read-only aktualisiert.", "success");
  } catch {
    notice("Projekt konnte nicht erneut verbunden werden. Prüfe GitHub-Leseberechtigung und Verbindung.", "error");
  }
}

async function deleteProjectData(project) {
  const expected = `DELETE DATA ${project.id}`;
  const description = `Löscht die aktuell gespeicherten Prompt-Entwürfe, Interviewverläufe, Korrekturen und Einstellungen für ${project.full_name}. Das GitHub-Repository bleibt bestehen. Ältere Commits im privaten Control-Repository können frühere Versionen enthalten.`;
  if (!await confirmation({ title: "Projektbezogene Daten löschen?", description, expected, label: `Zur Bestätigung „${expected}“ eingeben` })) return;
  try {
    await request(`/api/projects/${encodeURIComponent(project.id)}/data`, { method: "DELETE", body: JSON.stringify({ confirmation: expected }) });
    notice("Aktive PromptHub-Projektdaten gelöscht. GitHub und frühere Commit-Versionen bleiben bestehen.", "success");
    await loadProjects();
  } catch {
    notice("Die Projektdaten konnten nicht gelöscht werden; möglicherweise blockiert ein Auftrag.", "error");
  }
}

async function loadProjects() {
  try {
    const payload = await request("/api/projects");
    state.projects = payload.projects;
    if (!state.projects.some((item) => item.id === state.selectedProject && item.status === "connected")) {
      state.selectedProject = state.projects.find((item) => item.status === "connected")?.id ?? null;
    }
    renderProjects();
    renderProjectDetail();
    if (state.selectedProject) await Promise.all([loadJobs(), loadIncidents()]);
  } catch (error) {
    state.projects = [];
    renderProjects();
    renderProjectDetail();
    renderIncidents();
    if (error.status === 501) notice("Multi-Projektverwaltung ist erst nach Einrichtung der GitHub-Control-Plane verfügbar.");
    else notice("Projektübersicht konnte nicht geladen werden.", "error");
  }
}

function renderJobs() {
  const visible = state.selectedProject ? state.jobs.filter((job) => job.project.toLowerCase() === state.selectedProject) : state.jobs;
  elements.jobCount.textContent = `${visible.length} ${visible.length === 1 ? "Auftrag" : "Aufträge"}`;
  elements.jobs.replaceChildren();
  if (!visible.length) {
    addText(elements.jobs, "p", state.selectedProject ? "Für dieses Projekt liegen noch keine Aufträge vor." : "Verbinde ein Projekt, um projektbezogene Aufträge zu sehen.", "empty");
    return;
  }
  for (const job of visible) {
    const card = document.createElement("article");
    card.className = "job-card";
    const header = document.createElement("header");
    addText(header, "h3", job.prompt_preview || job.id);
    addText(header, "span", statusLabel(job.status), `chip ${job.status}`);
    card.append(header);
    const meta = document.createElement("div");
    meta.className = "job-meta";
    addText(meta, "span", `Projekt: ${job.project}`, "chip");
    addText(meta, "span", `ID: ${job.id}`, "chip");
    addText(meta, "span", `Aktualisiert: ${new Date(job.updated_at).toLocaleString("de-DE")}`, "chip");
    card.append(meta);
    if (job.checkpoint) addText(card, "p", `Checkpoint · ${job.checkpoint.phase}: ${job.checkpoint.summary}`, "job-preview");
    if (job.events?.length) {
      const list = document.createElement("ul");
      list.className = "events";
      for (const event of job.events.slice(-4).reverse()) addText(list, "li", `${new Date(event.created_at).toLocaleTimeString("de-DE")} · ${event.summary}`);
      card.append(list);
    }
    if (["awaiting_approval", "stale", "paused"].includes(job.status)) {
      const actions = document.createElement("div");
      actions.className = "job-actions";
      if (job.status === "awaiting_approval") actions.append(button("Ausführung freigeben", "primary", () => decide(job.id, "approve")));
      else actions.append(button("Nach Prüfung fortsetzen", "primary", () => decide(job.id, "resume")));
      if (job.status !== "paused") actions.append(button("Pausieren", "secondary", () => decide(job.id, "pause")));
      card.append(actions);
    }
    elements.jobs.append(card);
  }
}

async function loadJobs() {
  const payload = await request("/api/jobs");
  state.jobs = payload.jobs;
  renderJobs();
}

async function decide(jobId, decision) {
  try {
    await request(`/api/jobs/${encodeURIComponent(jobId)}/approve`, { method: "POST", body: JSON.stringify({ decision }) });
    await loadJobs();
    notice(decision === "approve" ? "Ausführungsfreigabe gespeichert." : decision === "resume" ? "Auftrag fortgesetzt." : "Auftrag pausiert.", "success");
  } catch {
    notice("Die Statusentscheidung konnte nicht gespeichert werden.", "error");
  }
}

function renderMetrics(metrics, snapshot = {}) {
  const errors = metrics.errors ?? { status: "not_available" };
  const failureRate = metrics.observed.failed_job_rate === null ? "nicht berechenbar" : `${(metrics.observed.failed_job_rate * 100).toFixed(1)} %`;
  const trendPrefix = errors.failure_history_may_be_truncated ? "≥" : "";
  const items = [
    ["KI-Anbieteraufrufe", `${metrics.observed.designer_provider_calls} tatsächlich ausgelöste, verifizierte Prompt-Designer-Aufrufe`],
    ["Redundanz-Cache", `${metrics.observed.redundant_provider_requests_avoided} wiederverwendete oder zusammengeführte Analysen`],
    ["Fallback-Analysen", `${metrics.observed.fallback_analyses} mit deterministischem Fallback`],
    ["Codex-Modellaufrufe", metrics.observed.codex_model_calls.status === "measured" ? `${metrics.observed.codex_model_calls.value} gemessen` : "Nicht verfügbar"],
    ["Tokenverbrauch", metrics.tokens.status === "measured" || metrics.tokens.status === "partial"
      ? `${metrics.tokens.input_tokens.toLocaleString("de-DE")} Eingabe · ${metrics.tokens.output_tokens.toLocaleString("de-DE")} Ausgabe (${metrics.tokens.status === "partial" ? "teilweise gemessen" : "gemessen"}; ${metrics.tokens.measured_requests} Messdatensätze)`
      : "Nicht verfügbar · keine Tokens geschätzt"],
    ["Runner-Laufzeit / Wiederholungen", `${(metrics.observed.runtime_ms / 1000).toFixed(1)} s beobachtet · ${metrics.observed.retries} Wiederholungen`],
    ["Pflichtchecks", metrics.quality.checked_jobs ? `${metrics.quality.passed_jobs}/${metrics.quality.checked_jobs} Jobs mit bestandenen Checks` : "Noch keine abgeschlossenen Pflichtchecks"],
    ["Fehlerquote", `${failureRate} · ${metrics.observed.failed_jobs ?? 0}/${metrics.observed.completed_jobs ?? 0} abgeschlossene Jobs in der geladenen Stichprobe`],
    ["Fehlerentwicklung", errors.status === "not_available" ? "Nicht verfügbar" : `${trendPrefix}${errors.failure_observations_last_7d} Fehlerbeobachtungen letzte 7 Tage · ${trendPrefix}${errors.failure_observations_previous_7d} in den 7 Tagen davor${errors.failure_history_may_be_truncated ? " · ältere Historie kann gekürzt sein" : ""}`],
    ["Fehler / Regressionen", errors.status === "not_available" ? "Fehlerlernhistorie nicht verfügbar" : `${errors.observed_incidents} Vorfälle · ${errors.observed_failure_occurrences} beobachtete Runnerfehler · ${errors.recurring_failures} wiederkehrende Muster · ${errors.confirmed_regressions} aktuell belegte bestätigte Regressionen`],
    ["Verbesserungsnachweise", errors.status === "not_available" ? "Nicht verfügbar" : `${errors.confirmed_causes} Ursachen bestätigt (${errors.archived_confirmed_causes ?? 0} ohne aktuell gespeicherten Jobbeleg) · ${errors.open_hypotheses} Hypothesen offen · ${errors.user_reports} Nutzerberichte`],
    ["GitHub-CI-Signale", `${metrics.ci_diagnostic?.failed_runs_in_recent_project_snapshots ?? 0} fehlgeschlagene Läufe in jüngsten Snapshots · keine Ursachenbestätigung`],
    ["Executor-Starts", `${metrics.observed.executor_invocations} tatsächlich gestartete Executor-Aufrufe`],
    ["Datenstand", `${snapshot.measured_at ? new Date(snapshot.measured_at).toLocaleTimeString("de-DE") : "unbekannt"} · ${snapshot.cache_source === "live" ? "live gelesen" : snapshot.cache_source === "coalesced" ? "gemeinsame Abfrage" : "kurz zwischengespeichert"} · ${snapshot.coverage?.listed_jobs ?? 0} gelistete Jobs${snapshot.coverage?.job_list_limit ? ` (max. ${snapshot.coverage.job_list_limit}${snapshot.coverage.job_list_may_be_limited ? ", Grenze erreicht" : ""})` : ""} · ${snapshot.coverage?.retained_prompt_drafts ?? 0} Entwürfe aus ${snapshot.coverage?.connected_projects ?? 0} Projekten (max. ${snapshot.coverage?.prompt_draft_retention_per_project ?? 50}/Projekt)`],
  ];
  elements.metrics.replaceChildren();
  for (const [label, value] of items) {
    const item = document.createElement("div");
    item.className = "metric-item";
    addText(item, "span", label, "metric-label");
    addText(item, "strong", value, "metric-value");
    elements.metrics.append(item);
  }
  elements.jobCap.textContent = `${metrics.observed.active_jobs ?? 0} / 2 aktive Jobs`;
}

async function loadMetrics() {
  try {
    const snapshot = await request("/api/metrics");
    renderMetrics(snapshot.metrics, snapshot);
  } catch {
    elements.metrics.textContent = "Nutzungswerte derzeit nicht verfügbar.";
  }
}

function renderDraft(draft) {
  state.draft = draft;
  elements.draftView.hidden = false;
  elements.draftView.replaceChildren();
  const sourceLabel = draft.source === "deterministic_fallback"
    ? "Analysequelle: strukturierter Fallback, keine Modellanfrage"
    : draft.source === "provider_fallback"
      ? "Verifizierter Anbieter angefragt; wegen ungültiger Antwort wurde der strukturierte Fallback verwendet"
      : "Analysequelle: verifizierter kostenfreier Anbieter";
  addText(elements.draftView, "p", sourceLabel, "chip");
  addText(elements.draftView, "h3", `Schritt: ${draft.stage}`);
  const analysis = document.createElement("div");
  analysis.className = "analysis-summary";
  addText(analysis, "p", `Erkanntes Ziel: ${draft.analysis.goals.join("; ")}`);
  addText(analysis, "p", `Komplexität: ${draft.analysis.complexity}/5 · Risiko: ${draft.analysis.risks[0]?.level ?? "niedrig"}`);
  if (draft.analysis.knowledge_hints.length) {
    addText(analysis, "p", "Relevante Quellenmuster:", "metric-label");
    for (const hint of draft.analysis.knowledge_hints) {
      const link = document.createElement("a");
      link.href = hint.source_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = hint.title;
      analysis.append(link, document.createElement("br"));
    }
  }
  elements.draftView.append(analysis);

  if (draft.stage === "analysis") {
    elements.draftView.append(button("Kritisches Interview starten", "primary", async () => runDraftAction("start")));
    elements.draftView.append(button("Interview überspringen", "secondary", async () => runDraftAction("finish")));
  } else if (draft.stage === "interview") {
    const current = draft.analysis.questions.find((item) => item.id === draft.current_question_id);
    if (current) {
      addText(elements.draftView, "h4", current.prompt);
      addText(elements.draftView, "p", current.recommendation_reason, "recommendation");
      current.options.forEach((option, index) => {
        elements.draftView.append(button(`${option.recommended ? "Empfehlung · " : ""}${option.label}`, option.recommended ? "primary" : "secondary", async () => runDraftAction("answer", { questionId: current.id, optionIndex: index })));
      });
      const freeForm = document.createElement("div");
      freeForm.className = "inline-form interview-answer";
      const answer = document.createElement("input");
      answer.placeholder = "Eigene Antwort …";
      const send = button("Antwort", "secondary", async () => {
        if (!answer.value.trim()) return;
        await runDraftAction("answer", { questionId: current.id, text: answer.value.trim() });
      });
      freeForm.append(answer, send);
      elements.draftView.append(freeForm);
      elements.draftView.append(button("Diese Frage überspringen", "secondary", async () => runDraftAction("skip")));
      elements.draftView.append(button("Interview beenden", "secondary", async () => runDraftAction("finish")));
    }
  } else if (draft.stage === "consolidated") {
    addText(elements.draftView, "h4", "Bestätigte Anforderungen");
    const list = document.createElement("ul");
    addText(list, "li", draft.intent);
    for (const answer of draft.answers) addText(list, "li", `${answer.question}: ${answer.value}${answer.recommended ? " · Empfehlung gewählt" : " · Nutzerentscheidung"}`);
    elements.draftView.append(list);
    if (draft.assumptions.length) {
      addText(elements.draftView, "h4", "Annahmen");
      for (const assumption of draft.assumptions) addText(elements.draftView, "p", assumption);
    } else addText(elements.draftView, "p", "Annahmen: keine zusätzlichen fachlichen Annahmen.", "muted");
    for (const review of draft.decision_reviews) addText(elements.draftView, "p", `Kritische Prüfung: ${review.explanation} Deine Auswahl bleibt maßgeblich.`, "recommendation");
    elements.draftView.append(button("Codex-Prompt erstellen und prüfen", "primary", async () => runDraftAction("generate")));
    elements.draftView.append(button("Prompt als Markdown exportieren", "secondary", async () => exportDraft()));
  } else if (["generated", "handoff_pending", "submitted"].includes(draft.stage)) {
    const latest = draft.versions.at(-1);
    if (latest) {
      addText(elements.draftView, "h4", `Prompt-Version ${latest.number} · ${latest.qa.passed ? "QA bestanden" : "QA blockiert"}`);
      for (const issue of latest.qa.issues) addText(elements.draftView, "p", issue, "error-text");
      for (const warning of latest.qa.warnings) addText(elements.draftView, "p", warning, "recommendation");
      const pre = document.createElement("pre");
      pre.className = "prompt-preview";
      pre.textContent = latest.prompt;
      elements.draftView.append(pre);
      elements.draftView.append(button("Prompt als Markdown exportieren", "secondary", async () => exportDraft()));
      if (draft.stage === "generated") {
        const approve = button("Version freigeben und Auftrag erstellen", "primary", async () => runDraftAction("approve", { version: latest.number, confirm: true }));
        approve.disabled = !latest.qa.passed;
        elements.draftView.append(approve);
        elements.draftView.append(button("Interview/Anforderungen ändern", "secondary", async () => notice("Für Änderungen erstelle einen neuen Entwurf, damit die geprüfte Version unverändert bleibt.")));
      }
    }
    if (draft.job_id) addText(elements.draftView, "p", `An Entwicklungssteuerung übergeben: ${draft.job_id}`, "success-text");
  }
}

async function runDraftAction(action, payload = {}) {
  const draft = state.draft;
  if (!draft) return;
  try {
    const result = await request(`/api/designer/drafts/${encodeURIComponent(draft.id)}/${action}`, { method: "POST", body: JSON.stringify({ project: draft.project, ...payload }) });
    if (result.draft) renderDraft(result.draft);
    if (result.job) {
      await Promise.all([loadJobs(), loadMetrics()]);
      notice(`Prompt freigegeben; Auftrag ${result.job.id} wurde erstellt.`, "success");
      const saved = await request(`/api/designer/drafts/${encodeURIComponent(draft.id)}?project=${encodeURIComponent(draft.project)}`);
      renderDraft(saved.draft);
    }
  } catch (error) {
    notice(error.message || "Prompt-Designer-Schritt fehlgeschlagen.", "error");
  }
}

async function exportDraft() {
  const draft = state.draft;
  if (!draft) return;
  try {
    const { files } = await request(`/api/designer/drafts/${encodeURIComponent(draft.id)}/export?project=${encodeURIComponent(draft.project)}`);
    for (const file of files) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([file.content], { type: "text/markdown;charset=utf-8" }));
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }
    notice(`${files.length} Markdown-Datei(en) exportiert.`, "success");
  } catch { notice("Markdown-Export fehlgeschlagen.", "error"); }
}

function renderLibrary() {
  const query = elements.librarySearch.value.trim().toLocaleLowerCase("de-DE");
  const category = elements.libraryCategory.value;
  const results = state.library.filter((entry) => (!category || entry.categories.includes(category)) && (!query || [entry.title, entry.summary, entry.publisher, ...(entry.categories ?? []), ...(entry.tags ?? [])].join(" ").toLocaleLowerCase("de-DE").includes(query)));
  elements.libraryResults.replaceChildren();
  if (!results.length) return addText(elements.libraryResults, "p", "Keine passenden Quellenmuster.", "empty");
  for (const entry of results) {
    const card = document.createElement("article");
    card.className = "library-entry";
    const review = state.libraryReviews.get(entry.id) ?? {};
    const heading = document.createElement("header");
    addText(heading, "h3", entry.title);
    heading.append(button(state.favorites.has(entry.id) ? "★" : "☆", "icon-button favorite-button", () => toggleFavorite(entry.id)));
    card.append(heading);
    addText(card, "p", entry.summary);
    addText(card, "p", `${entry.publisher} · ${entry.author} · geprüft ${entry.retrieved_at}`, "muted");
    addText(card, "p", `Lizenz: ${entry.license_status}`, "muted");
    if (entry.freshness === "review_due") addText(card, "p", "Quellenprüfung fällig", "chip paused");
    addText(card, "p", `Qualitätsprognose: ${Object.entries(entry.quality_estimate).filter(([key]) => key !== "method").map(([key, value]) => `${key} ${value}/5`).join(" · ")} · keine Praxisergebnisse bestätigt`, "muted");
    if (review.note) addText(card, "p", `Eigene Notiz: ${review.note}`, "recommendation");
    if (review.correction) addText(card, "p", `Korrekturhinweis v${review.version}: ${review.correction}`, "muted");
    const link = document.createElement("a");
    link.href = entry.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Quelle öffnen";
    card.append(link, button("Notiz / Korrektur", "secondary", () => editLibraryReview(entry.id, review)));
    elements.libraryResults.append(card);
  }
}

async function toggleFavorite(id) {
  const existing = state.libraryReviews.get(id) ?? {};
  try {
    const { review } = await request(`/api/prompt-library/${encodeURIComponent(id)}/review`, { method: "PUT", body: JSON.stringify({ favorite: !state.favorites.has(id), ...(existing.note ? { note: existing.note } : {}), ...(existing.correction ? { correction: existing.correction } : {}) }) });
    state.libraryReviews.set(id, review);
    if (review.favorite) state.favorites.add(id); else state.favorites.delete(id);
    renderLibrary();
  } catch { notice("Favorit konnte nicht im privaten Control-Repository gespeichert werden.", "error"); }
}

async function editLibraryReview(id, existing) {
  const form = document.createElement("div");
  const note = document.createElement("textarea");
  note.rows = 2;
  note.maxLength = 1500;
  note.value = existing.note ?? "";
  const correction = document.createElement("textarea");
  correction.rows = 2;
  correction.maxLength = 1500;
  correction.value = existing.correction ?? "";
  const noteLabel = addText(form, "label", "Eigene Notiz");
  noteLabel.append(note);
  const correctionLabel = addText(form, "label", "Korrekturvorschlag (ändert die Originalquelle nicht)");
  correctionLabel.append(correction);
  if (!await confirmation({ title: "Bibliotheksnotiz bearbeiten", description: form, expected: "SAVE REVIEW", label: "Zur Speicherung SAVE REVIEW eingeben" })) return;
  try {
    const { review } = await request(`/api/prompt-library/${encodeURIComponent(id)}/review`, { method: "PUT", body: JSON.stringify({ favorite: state.favorites.has(id), note: note.value, correction: correction.value }) });
    state.libraryReviews.set(id, review);
    renderLibrary();
    notice(`Bibliotheksnotiz als Version ${review.version} gespeichert.`, "success");
  } catch { notice("Bibliotheksnotiz konnte nicht gespeichert werden.", "error"); }
}

async function loadLibrary() {
  const { entries } = await request("/api/prompt-library");
  state.library = entries;
  const reviews = await request("/api/prompt-library/reviews").catch(() => ({ reviews: [] }));
  state.libraryReviews = new Map(reviews.reviews.map((review) => [review.entry_id, review]));
  state.favorites = new Set(reviews.reviews.filter((review) => review.favorite).map((review) => review.entry_id));
  const categories = [...new Set(entries.flatMap((entry) => entry.categories ?? []))].sort();
  const previous = elements.libraryCategory.value;
  elements.libraryCategory.replaceChildren(new Option("Alle Kategorien", ""));
  for (const category of categories) elements.libraryCategory.append(new Option(category, category));
  elements.libraryCategory.value = categories.includes(previous) ? previous : "";
  renderLibrary();
}

elements.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const repository = new FormData(elements.projectForm).get("repository").trim();
  try {
    const { project } = await request("/api/projects", { method: "POST", body: JSON.stringify({ repository }) });
    await loadProjects();
    selectProject(project.id);
    elements.projectForm.reset();
    notice("Repository read-only analysiert und mit PromptHub verbunden.", "success");
  } catch (error) {
    notice(error.message === "repository must use owner/name form" ? "Bitte ein Repository im Format owner/name angeben." : "Repository konnte nicht verbunden werden. Prüfe Leseberechtigung und GitHub-Control-Plane.", "error");
  }
});

elements.designerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedProject) return notice("Wähle zuerst ein verbundenes Projekt.", "error");
  try {
    const draft = await request("/api/designer/drafts", { method: "POST", body: JSON.stringify({ project: state.selectedProject, intent: elements.intent.value, attachments: state.attachments, deliverable: el("#deliverable").value }) });
    renderDraft(draft.draft);
    notice("Wunsch analysiert. Die Quelle ist als strukturierter Fallback ausgewiesen.", "success");
  } catch (error) {
    notice(error.message || "Wunsch konnte nicht analysiert werden.", "error");
  }
});

el("#attachments").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (files.length > 3) { notice("Maximal drei Textanhänge auswählen.", "error"); event.target.value = ""; return; }
  try {
    state.attachments = await Promise.all(files.map(async (file) => {
      if (file.size > 8_000) throw new Error(`${file.name} überschreitet das lokale Limit von 8 KB.`);
      if (!/\.(txt|md|json|yaml|yml|csv)$/i.test(file.name)) throw new Error("Nur Text-, Markdown-, JSON-, YAML- und CSV-Dateien sind zulässig.");
      return { name: file.name, text: await file.text() };
    }));
    el("#attachment-label").textContent = state.attachments.length ? `${state.attachments.length} Datei(en) lokal gelesen` : "Keine Anhänge";
  } catch (error) {
    state.attachments = [];
    event.target.value = "";
    el("#attachment-label").textContent = "Keine Anhänge";
    notice(error.message, "error");
  }
});

el("#voice-input").addEventListener("click", () => {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) return notice("Spracheingabe wird von diesem Browser nicht unterstützt.");
  const recognition = new Speech();
  recognition.lang = "de-DE";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => { elements.intent.value = `${elements.intent.value}${elements.intent.value ? " " : ""}${event.results[0][0].transcript}`; };
  recognition.onerror = () => notice("Spracheingabe konnte nicht abgeschlossen werden.", "error");
  recognition.start();
});

el("#library-search").addEventListener("input", renderLibrary);
el("#library-category").addEventListener("change", renderLibrary);
el("#refresh").addEventListener("click", async () => {
  await Promise.all([loadProjects(), loadMetrics()]);
  notice("Projekt- und Nutzungsübersicht aktualisiert.", "success");
});
el("#logout").addEventListener("click", async () => {
  await request("/api/logout", { method: "POST" }).catch(() => {});
  window.location.reload();
});

async function boot() {
  try {
    const { user, local } = await request("/api/me");
    state.user = user;
    elements.userLabel.textContent = `${local ? "Lokale Sitzung" : "GitHub"} · ${user.login}`;
    elements.authPanel.hidden = true;
    elements.appPanel.hidden = false;
    await Promise.all([loadLibrary(), loadProjects(), loadMetrics()]);
  } catch (error) {
    if (error.status === 401) {
      elements.authPanel.hidden = false;
      elements.appPanel.hidden = true;
      notice("Nicht angemeldet.");
    } else notice("Die Control API ist derzeit nicht erreichbar.", "error");
  }
}

if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) el("#voice-input").disabled = true;
elements.incidentReportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedProject) return notice("Wähle zuerst ein verbundenes Projekt.", "error");
  const components = elements.incidentComponents.value.split(",").map((item) => item.trim()).filter(Boolean);
  try {
    await request(`/api/projects/${encodeURIComponent(state.selectedProject)}/incidents`, { method: "POST", body: JSON.stringify({ summary: elements.incidentSummary.value, components }) });
    elements.incidentReportForm.reset();
    await Promise.all([loadIncidents(), loadMetrics()]);
    notice("Fehlerbericht projektbezogen gespeichert; Ursache bleibt unbestätigt.", "success");
  } catch (error) { notice(error.message || "Fehlerbericht konnte nicht gespeichert werden.", "error"); }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
boot();
