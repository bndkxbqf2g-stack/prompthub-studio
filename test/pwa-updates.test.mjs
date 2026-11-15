import test from "node:test";
import assert from "node:assert/strict";
import { registerServiceWorker } from "../src/pwa/service-worker-client.mjs";

function eventTarget(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? [];
      group.push(listener);
      listeners.set(type, group);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

test("PWA update prompts only after install and reloads once after user action", async () => {
  const waitingMessages = [];
  const worker = eventTarget({ state: "installing", postMessage(message) { waitingMessages.push(message); } });
  const registration = eventTarget({ waiting: null, installing: worker });
  const serviceWorker = eventTarget({ controller: {} });
  serviceWorker.register = async (path) => {
    assert.equal(path, "/sw.js");
    return registration;
  };
  const updateButton = eventTarget({ hidden: true });
  let reloads = 0;

  await registerServiceWorker({ navigatorObject: { serviceWorker }, updateButton, reload: () => { reloads += 1; } });
  registration.dispatch("updatefound");
  worker.state = "installed";
  worker.dispatch("statechange");
  assert.equal(updateButton.hidden, false);

  updateButton.dispatch("click");
  assert.deepEqual(waitingMessages, [{ type: "PROMPTHUB_ACTIVATE_UPDATE" }]);
  serviceWorker.dispatch("controllerchange");
  serviceWorker.dispatch("controllerchange");
  assert.equal(reloads, 1);
});

test("first service worker install does not prompt or reload automatically", async () => {
  const worker = eventTarget({ state: "installing", postMessage() { assert.fail("no update should be requested"); } });
  const registration = eventTarget({ waiting: null, installing: worker });
  const serviceWorker = eventTarget({ controller: null });
  serviceWorker.register = async () => registration;
  const updateButton = eventTarget({ hidden: true });
  let reloads = 0;

  await registerServiceWorker({ navigatorObject: { serviceWorker }, updateButton, reload: () => { reloads += 1; } });
  registration.dispatch("updatefound");
  worker.state = "installed";
  worker.dispatch("statechange");
  serviceWorker.dispatch("controllerchange");
  assert.equal(updateButton.hidden, true);
  assert.equal(reloads, 0);
});
