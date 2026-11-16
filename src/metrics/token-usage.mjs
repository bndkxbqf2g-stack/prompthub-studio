export const TOKEN_USAGE_SOURCES = Object.freeze(["execution_provider", "verified_free_provider"]);

export function normalizeTokenUsage(usage, source) {
  if (!TOKEN_USAGE_SOURCES.includes(source)) return null;
  if (!usage || typeof usage !== "object") return null;
  const fields = ["input_tokens", "output_tokens", "cached_input_tokens", "reasoning_output_tokens"];
  const measured = Object.fromEntries(fields.flatMap((field) => Number.isSafeInteger(usage[field]) && usage[field] >= 0 ? [[field, usage[field]]] : []));
  if (!Object.hasOwn(measured, "input_tokens") && !Object.hasOwn(measured, "output_tokens")) return null;
  return {
    ...measured,
    source,
  };
}
