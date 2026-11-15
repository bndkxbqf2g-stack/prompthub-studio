import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PromptLibrary } from "./prompt-library.mjs";

export async function loadPromptLibrary({ path = join(process.cwd(), "knowledge", "prompt-library.json"), now } = {}) {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (value.schema_version !== 1 || !Array.isArray(value.entries)) throw new Error("prompt library schema is unsupported");
  return new PromptLibrary({ entries: value.entries, now });
}
