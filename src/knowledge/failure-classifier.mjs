const FAILURE_SIGNALS = Object.freeze([
  ["assertion_failure", /(?:AssertionError|assertion failed|expected .{1,120} (?:to equal|but received|but got))/i],
  ["syntax_error", /(?:SyntaxError|parse error|unexpected token)/i],
  ["missing_dependency", /(?:MODULE_NOT_FOUND|Cannot find (?:module|package)|package .* not found|ENOENT)/i],
  ["permission_denied", /(?:EACCES|EPERM|permission denied|access is denied)/i],
  ["timeout", /(?:ETIMEDOUT|timed? ?out|timeout exceeded)/i],
  ["network_failure", /(?:ECONNREFUSED|ENOTFOUND|network is unreachable|fetch failed)/i],
  ["type_error", /(?:TypeError|ReferenceError|cannot read properties of undefined)/i],
  ["test_runner_crash", /(?:test process exited|worker process.*(?:crash|terminated)|uncaught exception)/i],
]);

// Inspect output only in memory; return a fixed vocabulary and never persist raw logs.
export function classifyFailurePatterns(output) {
  const sample = typeof output === "string" ? output.slice(-4000) : "";
  const matches = FAILURE_SIGNALS.filter(([, pattern]) => pattern.test(sample)).map(([name]) => name);
  return matches.length ? matches : ["unclassified"];
}

export const FAILURE_PATTERN_NAMES = Object.freeze([...FAILURE_SIGNALS.map(([name]) => name), "unclassified"]);
