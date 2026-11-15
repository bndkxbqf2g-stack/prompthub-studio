import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "knowledge", "prompt-library.json");
const outputPath = resolve(root, "src", "cloudflare", "prompt-library-data.mjs");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const generated = `// Generated from knowledge/prompt-library.json by scripts/sync-prompt-library.mjs.\nexport default ${JSON.stringify(source, null, 2)};\n`;

if (process.argv.includes("--check")) {
  let current;
  try {
    current = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current !== generated) {
    console.error("Cloudflare prompt-library module is stale; run npm run sync:prompt-library.");
    process.exitCode = 1;
  } else {
    console.log("Cloudflare prompt-library module matches its JSON source");
  }
} else {
  await writeFile(outputPath, generated, "utf8");
  console.log("Generated Cloudflare prompt-library module");
}
