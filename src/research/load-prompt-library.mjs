import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PromptLibrary } from "./prompt-library.mjs";

const DEFAULT_PATH = fileURLToPath(new URL("../../knowledge/prompt-library.json", import.meta.url));

export async function loadPromptLibrary({ path = DEFAULT_PATH, now } = {}) {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (value.schema_version !== 1 || !Array.isArray(value.entries)) throw new Error("prompt library schema is unsupported");
  return new PromptLibrary({ entries: value.entries, now });
}
