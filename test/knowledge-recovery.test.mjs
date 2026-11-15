import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KnowledgeStore } from "../src/knowledge/knowledge-store.mjs";
import { createBackup, restoreBackup, verifyBackup } from "../src/recovery/backup.mjs";

async function tempDirectory(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

test("knowledge store preserves sources and supersession", async () => {
  const root = await tempDirectory("prompthub-knowledge-");
  try {
    const store = new KnowledgeStore({ root });
    const first = await store.recordDecision({ title: "Use GitHub as control plane", context: "Mac must not accept inbound connections", decision: "Runner polls GitHub", sourceRefs: ["ARCHITECTURE.md"] });
    const second = await store.recordDecision({ title: "Use CAS leases", context: "Two runners may race", decision: "Contents API update with SHA", sourceRefs: ["SECURITY_RULES.md", "test/lease-store.test.mjs"] });
    await store.supersede(first.id, second.id);
    assert.equal((await store.listDecisions()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("backup verification detects tampering and restore requires approval", async () => {
  const root = await tempDirectory("prompthub-backup-");
  const source = join(root, "source");
  const backup = join(root, "backup");
  const restore = join(root, "restore");
  try {
    await writeFile(join(root, "source.txt"), "safe state\n");
    await createBackup({ sourceRoot: root, relativeFiles: ["source.txt"], destinationRoot: backup });
    assert.equal((await verifyBackup({ backupRoot: backup })).valid, true);
    await assert.rejects(() => restoreBackup({ backupRoot: backup, destinationRoot: restore }), /approval/);
    const restored = await restoreBackup({ backupRoot: backup, destinationRoot: restore, approved: true });
    assert.deepEqual(restored.restored, ["source.txt"]);
    assert.equal((await readFile(join(restore, "source.txt"), "utf8")).trim(), "safe state");
    await writeFile(join(backup, "source.txt"), "tampered\n");
    assert.equal((await verifyBackup({ backupRoot: backup })).valid, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
