import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { writeJsonAtomic } from "../storage/json-store.mjs";

function safeRelative(root, value) {
  if (typeof value !== "string" || isAbsolute(value)) throw new Error("backup path must be relative");
  const candidate = resolve(root, value);
  const rel = relative(resolve(root), candidate);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || normalize(rel) !== normalize(value)) throw new Error("backup path escapes root");
  return { absolute: candidate, relative: rel.replaceAll("\\", "/") };
}

async function checksum(path) {
  const content = await readFile(path);
  return { sha256: createHash("sha256").update(content).digest("hex"), bytes: content.byteLength };
}

export async function createBackup({ sourceRoot, relativeFiles, destinationRoot, createdAt = new Date() } = {}) {
  if (!sourceRoot || !destinationRoot || !Array.isArray(relativeFiles) || relativeFiles.length === 0) throw new Error("sourceRoot, destinationRoot and relativeFiles are required");
  await mkdir(destinationRoot, { recursive: true });
  const entries = [];
  for (const file of relativeFiles) {
    const source = safeRelative(sourceRoot, file);
    if (source.relative === "manifest.json") throw new Error("manifest.json is reserved");
    const destination = safeRelative(destinationRoot, source.relative);
    await access(source.absolute);
    const info = await stat(source.absolute);
    if (!info.isFile()) throw new Error(`backup source is not a file: ${source.relative}`);
    await mkdir(resolve(destination.absolute, ".."), { recursive: true });
    await copyFile(source.absolute, destination.absolute, constants.COPYFILE_EXCL);
    const digest = await checksum(destination.absolute);
    entries.push({ path: source.relative, ...digest });
  }
  const manifest = { schema_version: 1, created_at: createdAt.toISOString(), files: entries };
  await writeJsonAtomic(join(destinationRoot, "manifest.json"), manifest);
  return manifest;
}

export async function verifyBackup({ backupRoot } = {}) {
  const manifest = JSON.parse(await readFile(join(backupRoot, "manifest.json"), "utf8"));
  if (!manifest || manifest.schema_version !== 1 || !Array.isArray(manifest.files)) throw new Error("backup manifest is invalid");
  const mismatches = [];
  for (const entry of manifest.files) {
    try {
      const path = safeRelative(backupRoot, entry.path).absolute;
      const digest = await checksum(path);
      if (digest.sha256 !== entry.sha256 || digest.bytes !== entry.bytes) mismatches.push(entry.path);
    } catch {
      mismatches.push(entry.path);
    }
  }
  return { valid: mismatches.length === 0, mismatches, manifest };
}

export async function restoreBackup({ backupRoot, destinationRoot, approved = false, overwrite = false } = {}) {
  if (approved !== true) throw new Error("restore requires explicit approval");
  const verification = await verifyBackup({ backupRoot });
  if (!verification.valid) throw new Error("backup verification failed");
  await mkdir(destinationRoot, { recursive: true });
  for (const entry of verification.manifest.files) {
    const source = safeRelative(backupRoot, entry.path).absolute;
    const destination = safeRelative(destinationRoot, entry.path).absolute;
    let exists = false;
    try {
      await access(destination);
      exists = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (exists && !overwrite) throw new Error(`restore target exists: ${entry.path}`);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await copyFile(source, destination);
  }
  return { restored: verification.manifest.files.map((entry) => entry.path), verified: true };
}
