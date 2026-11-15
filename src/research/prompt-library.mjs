function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isStale(entry, now) {
  return Boolean(entry.review_after && new Date(entry.review_after).getTime() < now.getTime());
}

export class PromptLibrary {
  constructor({ entries = [], now = () => new Date() } = {}) {
    this.entries = structuredClone(entries);
    this.now = now;
  }

  audit() {
    const ids = new Set();
    const urls = new Map();
    const conflictGroups = new Map();
    const issues = [];
    for (const entry of this.entries) {
      if (ids.has(entry.id)) issues.push({ type: "duplicate_id", entry_id: entry.id });
      ids.add(entry.id);
      const url = normalize(entry.source_url);
      if (urls.has(url)) issues.push({ type: "duplicate_source", entry_ids: [urls.get(url), entry.id] });
      else urls.set(url, entry.id);
      if (isStale(entry, this.now())) issues.push({ type: "stale_source", entry_id: entry.id });
      if (!entry.license_status || !entry.source_url || !entry.retrieved_at) issues.push({ type: "missing_provenance", entry_id: entry.id });
      const reviewedText = [entry.title, entry.summary, ...(entry.tags ?? []), ...(entry.risk_notes ?? [])].join(" ");
      if (/(ignore\s+(?:all\s+)?(?:security|approval|tests)|exfiltrat|reveal\s+(?:the\s+)?secret)/i.test(reviewedText)) {
        issues.push({ type: "unsafe_instruction", entry_id: entry.id });
      }
      if (entry.conflict_group && entry.stance) {
        const group = conflictGroups.get(entry.conflict_group) ?? [];
        group.push({ id: entry.id, stance: entry.stance });
        conflictGroups.set(entry.conflict_group, group);
      }
    }
    for (const [group, members] of conflictGroups) {
      const stances = new Set(members.map((member) => member.stance));
      if (stances.size > 1) issues.push({ type: "conflicting_recommendations", group, entry_ids: members.map((member) => member.id) });
    }
    return issues;
  }

  get(id) {
    const entry = this.entries.find((item) => item.id === id);
    return entry ? { ...entry, freshness: isStale(entry, this.now()) ? "review_due" : "current" } : null;
  }

  search(query = "", { category = "", limit = 30, favorites = [] } = {}) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const normalizedCategory = normalize(category);
    const favoriteIds = new Set(favorites);
    return this.entries.map((entry) => {
      const haystack = normalize([entry.title, entry.summary, entry.publisher, entry.author, ...(entry.categories ?? []), ...(entry.tags ?? [])].join(" "));
      const matched = terms.filter((term) => haystack.includes(term));
      const categoryMatch = !normalizedCategory || (entry.categories ?? []).some((item) => normalize(item) === normalizedCategory);
      return { entry, score: matched.length + (favoriteIds.has(entry.id) ? 0.25 : 0), matches: matched.length === terms.length && categoryMatch };
    }).filter((item) => item.matches)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      .slice(0, limit)
      .map(({ entry }) => ({ ...entry, freshness: isStale(entry, this.now()) ? "review_due" : "current" }));
  }

  interviewHints({ project = "", intent = "" } = {}) {
    const terms = normalize(`${intent} ${project}`).split(/\s+/).filter((term) => term.length >= 4);
    return this.entries.map((entry) => {
      const searchable = normalize([entry.title, entry.summary, ...(entry.categories ?? []), ...(entry.tags ?? [])].join(" "));
      const matched = terms.filter((term) => searchable.includes(term)).length;
      const general = (entry.categories ?? []).some((category) => ["prompt-design", "workflow", "development-workflow", "agent-architecture"].includes(category));
      const security = /\b(auth|security|secret|permission|production|database|migration|delete|remove)\b/i.test(intent) && (entry.categories ?? []).includes("security");
      return { entry, score: matched + (security ? 3 : 0) + (general ? 1 : 0) };
    }).filter(({ score, entry }) => score > 0 && entry.risk_notes?.length)
      .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
      .slice(0, 6)
      .map(({ entry }) => ({ id: entry.id, title: entry.title, source_url: entry.source_url, summary: entry.summary, hints: entry.interview_hints ?? [], risks: entry.risk_notes ?? [] }));
  }
}
