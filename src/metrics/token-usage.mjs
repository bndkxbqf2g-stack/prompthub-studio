export function normalizeTokenUsage(usage, source) {
  if (!usage || typeof usage !== "object") return null;
  const input = Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0 ? usage.input_tokens : null;
  const output = Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0 ? usage.output_tokens : null;
  if (input === null && output === null) return null;
  return {
    ...(input === null ? {} : { input_tokens: input }),
    ...(output === null ? {} : { output_tokens: output }),
    source,
  };
}
