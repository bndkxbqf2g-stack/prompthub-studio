import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export async function readJsonFile(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(tempPath, path);
}
