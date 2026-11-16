import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("GitHub Pages project root opens the real PWA instead of rendering the README", async () => {
  const entry = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(entry, /http-equiv="refresh" content="0; url=\.\/src\/pwa\/"/);
  assert.match(entry, /new URL\("\.\/src\/pwa\/", window\.location\.href\)/);
  assert.match(entry, /href="\.\/src\/pwa\/"/);

  const destination = new URL("./src/pwa/", "https://bndkxbqf2g-stack.github.io/prompthub-studio/");
  assert.equal(destination.pathname, "/prompthub-studio/src/pwa/");
});
