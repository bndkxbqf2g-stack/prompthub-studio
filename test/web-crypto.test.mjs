import test from "node:test";
import assert from "node:assert/strict";
import { decodeBase64, decodeBase64Url, encodeBase64, encodeBase64Url, hmacBase64Url, sha256Hex, verifyHmacBase64Url } from "../src/security/web-crypto.mjs";

test("shared Web Crypto helpers preserve Unicode and produce stable digests", async () => {
  const value = "Grüße 👋 PromptHub";
  assert.equal(decodeBase64(encodeBase64(value)), value);
  assert.equal(decodeBase64Url(encodeBase64Url(value)), value);
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("HMAC sessions verify signed payloads without Node-only crypto APIs", async () => {
  const signature = await hmacBase64Url("session-id", "test-secret-value");
  assert.equal(await verifyHmacBase64Url("session-id", signature, "test-secret-value"), true);
  assert.equal(await verifyHmacBase64Url("different-id", signature, "test-secret-value"), false);
  assert.equal(await verifyHmacBase64Url("session-id", "invalid", "test-secret-value"), false);
});
