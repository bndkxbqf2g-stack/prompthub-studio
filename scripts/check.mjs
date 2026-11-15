import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Script } from "node:vm";

const forbidden = [
  /console\.log\([^\n]*(?:token|secret|password|cookie)/i,
  /process\.env\.(?:GITHUB_TOKEN|GITHUB_CLIENT_SECRET|SESSION_SECRET)\s*\)/,
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", ".git", "coverage"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && /\.(mjs|js|json|md|html|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const files = await walk(process.cwd());
const violations = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) violations.push(`${file}: ${pattern}`);
  }
  if (file.endsWith(".js")) {
    try {
      new Script(content, { filename: file });
    } catch (error) {
      violations.push(`${file}: JavaScript syntax error: ${error.message}`);
    }
  }
}
if (violations.length > 0) {
  console.error("Static security check failed:");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Static check passed for ${files.length} files`);
}
