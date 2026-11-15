const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function encodeBase64(value) {
  return bytesToBase64(encoder.encode(String(value)));
}

export function decodeBase64(value) {
  return decoder.decode(base64ToBytes(value));
}

export function encodeBase64Url(value) {
  return encodeBase64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeBase64Url(value) {
  const base64 = String(value).replaceAll("-", "+").replaceAll("_", "/");
  return decodeBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

export function randomBase64Url(byteLength) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function hmacBase64Url(value, secret) {
  const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyHmacBase64Url(value, signature, secret) {
  try {
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await globalThis.crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), encoder.encode(value));
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const base64 = String(value).replaceAll("-", "+").replaceAll("_", "/");
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
