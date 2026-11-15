import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonAtomic } from "../storage/json-store.mjs";

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/i,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  /(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s]+/i,
];

function safeText(value, field, max = 4000) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required`);
  if (value.length > max) throw new Error(`${field} exceeds the maximum length`);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) throw new Error(`${field} appears to contain a secret`);
  return value.trim();
}

function safeRefs(refs = []) {
  if (!Array.isArray(refs) || refs.length > 30 || refs.some((ref) => typeof ref !== "string" || ref.length > 300)) throw new Error("source references are invalid");
  return refs.slice();
}

async function readCollection(path, name) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (!parsed || parsed.schema_version !== 1 || !Array.isArray(parsed.entries)) throw new Error(`${name} has an unsupported schema`);
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return { schema_version: 1, entries: [] };
    throw error;
  }
}

export class KnowledgeStore {
  constructor({ root, now = () => new Date(), ruleVersion = "local" } = {}) {
    if (!root) throw new Error("knowledge root is required");
    this.root = root;
    this.now = now;
    this.ruleVersion = ruleVersion;
  }

  async init() {
    await mkdir(this.root, { recursive: true });
  }

  async recordDecision({ title, context, decision, alternatives = [], sourceRefs = [], scope = "project" } = {}) {
    await this.init();
    const now = this.now().toISOString();
    const entry = {
      id: `decision_${randomUUID()}`,
      type: "decision",
      title: safeText(title, "title", 300),
      context: safeText(context, "context"),
      decision: safeText(decision, "decision"),
      alternatives: alternatives.map((item) => safeText(item, "alternative", 1000)),
      source_refs: safeRefs(sourceRefs),
      scope: safeText(scope, "scope", 100),
      created_at: now,
      updated_at: now,
      superseded_by: null,
      rule_version: this.ruleVersion,
    };
    const path = join(this.root, "decisions.json");
    const collection = await readCollection(path, "decisions.json");
    collection.entries.push(entry);
    await writeJsonAtomic(path, collection);
    return structuredClone(entry);
  }

  async supersede(decisionId, replacementId) {
    const path = join(this.root, "decisions.json");
    const collection = await readCollection(path, "decisions.json");
    const current = collection.entries.find((entry) => entry.id === decisionId);
    const replacement = collection.entries.find((entry) => entry.id === replacementId);
    if (!current || !replacement) throw new Error("decision reference not found");
    current.superseded_by = replacementId;
    current.updated_at = this.now().toISOString();
    await writeJsonAtomic(path, collection);
    return structuredClone(current);
  }

  async listDecisions({ includeSuperseded = false } = {}) {
    const collection = await readCollection(join(this.root, "decisions.json"), "decisions.json");
    return collection.entries.filter((entry) => includeSuperseded || !entry.superseded_by).map((entry) => structuredClone(entry));
  }

  async recordStrategyEvaluation({ name, hypothesis, outcome, evidenceRefs = [], metrics = {}, critical = false } = {}) {
    await this.init();
    if (!["success", "failure", "inconclusive"].includes(outcome)) throw new Error("strategy outcome is invalid");
    const entry = {
      id: `strategy_${randomUUID()}`,
      type: "strategy_evaluation",
      name: safeText(name, "name", 300),
      hypothesis: safeText(hypothesis, "hypothesis"),
      outcome,
      evidence_refs: safeRefs(evidenceRefs),
      metrics: metrics && typeof metrics === "object" && !Array.isArray(metrics) ? structuredClone(metrics) : {},
      critical: critical === true,
      adopted: false,
      adopted_by: null,
      created_at: this.now().toISOString(),
      rule_version: this.ruleVersion,
    };
    const path = join(this.root, "strategies.json");
    const collection = await readCollection(path, "strategies.json");
    collection.entries.push(entry);
    await writeJsonAtomic(path, collection);
    return structuredClone(entry);
  }

  async adoptStrategy(strategyId, { approvedBy = "" } = {}) {
    const path = join(this.root, "strategies.json");
    const collection = await readCollection(path, "strategies.json");
    const entry = collection.entries.find((candidate) => candidate.id === strategyId);
    if (!entry) throw new Error("strategy evaluation not found");
    if (entry.outcome !== "success" || entry.evidence_refs.length < 2) throw new Error("insufficient evidence to adopt strategy");
    if (entry.critical && !approvedBy) throw new Error("critical strategy adoption requires human approval");
    entry.adopted = true;
    entry.adopted_by = approvedBy || "evidence-gate";
    await writeJsonAtomic(path, collection);
    return structuredClone(entry);
  }
}
