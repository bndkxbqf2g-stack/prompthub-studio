export const NETLIFY_FREE_CREDIT_LIMIT = 300;
export const NETLIFY_JOB_PAUSE_RATIO = 0.75;
export const NETLIFY_USAGE_MAX_AGE_MS = 15 * 60 * 1000;

function unknownStatus(reason = "authoritative_team_usage_unavailable") {
  return {
    status: "unknown",
    allowed: false,
    reason,
    credits_used: null,
    credits_limit: NETLIFY_FREE_CREDIT_LIMIT,
    measured_at: null,
    source: "not_connected",
  };
}

export function evaluateNetlifyQuota(snapshot, { now = Date.now(), maxAgeMs = NETLIFY_USAGE_MAX_AGE_MS } = {}) {
  if (
    !snapshot
    || snapshot.plan !== "free"
    || snapshot.hard_limit !== true
    || snapshot.auto_recharge_enabled !== false
    || snapshot.source !== "netlify_official_team_usage"
    || snapshot.credits_limit !== NETLIFY_FREE_CREDIT_LIMIT
    || !Number.isFinite(snapshot.credits_used)
    || snapshot.credits_used < 0
    || !Number.isFinite(Date.parse(snapshot.measured_at ?? ""))
  ) return unknownStatus();

  const measuredAt = Date.parse(snapshot.measured_at);
  if (measuredAt > now + 60_000 || now - measuredAt > maxAgeMs) return unknownStatus("authoritative_usage_is_stale");

  const status = snapshot.credits_used >= NETLIFY_FREE_CREDIT_LIMIT * NETLIFY_JOB_PAUSE_RATIO ? "paused" : "available";
  return {
    status,
    allowed: status === "available",
    reason: status === "paused" ? "free_credit_pause_threshold_reached" : null,
    credits_used: snapshot.credits_used,
    credits_limit: NETLIFY_FREE_CREDIT_LIMIT,
    measured_at: new Date(measuredAt).toISOString(),
    source: "netlify_official_team_usage",
  };
}

export function createNetlifyQuotaGate({ usageProvider = null, now = () => Date.now() } = {}) {
  async function status() {
    if (typeof usageProvider !== "function") return unknownStatus();
    try {
      return evaluateNetlifyQuota(await usageProvider(), { now: now() });
    } catch {
      return unknownStatus("authoritative_usage_read_failed");
    }
  }

  return Object.freeze({
    status,
    async check() {
      return status();
    },
  });
}
