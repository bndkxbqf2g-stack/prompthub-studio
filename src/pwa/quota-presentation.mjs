const SAFE_REASONS = Object.freeze({
  authoritative_team_usage_unavailable: "Der Free-Kontostand ist nicht verifiziert.",
  authoritative_usage_is_stale: "Der letzte Free-Kontostand ist veraltet.",
  authoritative_usage_read_failed: "Der Free-Kontostand konnte nicht gelesen werden.",
  free_credit_pause_threshold_reached: "Die konfigurierte Pausenschwelle wurde erreicht.",
  quota_status_unavailable: "Der Kontingentstatus ist nicht verfügbar.",
});

function measuredUsage(status) {
  if (status?.source !== "netlify_official_team_usage") return null;
  if (!Number.isSafeInteger(status.credits_used) || status.credits_used < 0) return null;
  if (!Number.isSafeInteger(status.credits_limit) || status.credits_limit < 1) return null;
  const timestamp = Date.parse(status.measured_at ?? "");
  if (!Number.isFinite(timestamp)) return null;
  const measuredAt = new Date(timestamp).toISOString().replace("T", " ").replace(".000Z", " UTC");
  return `${status.credits_used} von ${status.credits_limit} Credits, gemessen ${measuredAt}`;
}

export function quotaPresentation(status) {
  const state = ["available", "paused", "unknown", "not_gated"].includes(status?.status) ? status.status : "unknown";
  if (state === "not_gated" && status?.allowed === true) {
    return {
      tone: "local",
      message: "Lokaler Entwicklungsmodus: kein Cloud-Kontingent wird überwacht; dies ist keine Cloud-Freigabe.",
    };
  }

  if (state === "available" && status?.allowed === true) {
    const usage = measuredUsage(status);
    if (usage) return { tone: "allowed", message: `Cloud-Auftragsannahme freigegeben: ${usage}.` };
  }

  const reason = SAFE_REASONS[status?.reason] ?? "Der Free-Kontostand kann derzeit nicht verifiziert werden.";
  const usage = state === "paused" ? measuredUsage(status) : null;
  const suffix = usage ? ` Letzter bestätigter Stand: ${usage}.` : " Es werden keine Werte geschätzt.";
  return { tone: state === "paused" ? "paused" : "unknown", message: `Cloud-Aufträge pausiert: ${reason}${suffix}` };
}
