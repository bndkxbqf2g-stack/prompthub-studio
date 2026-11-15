export async function registerServiceWorker({
  navigatorObject = globalThis.navigator,
  updateButton,
  reload = () => globalThis.location.reload(),
} = {}) {
  if (!navigatorObject?.serviceWorker || !updateButton) return null;

  let registration;
  try {
    registration = await navigatorObject.serviceWorker.register("/sw.js");
  } catch {
    updateButton.hidden = true;
    return null;
  }

  let updateRequested = false;
  let reloaded = false;
  let waitingWorker = registration.waiting ?? null;
  const showWaitingUpdate = (worker = registration.waiting) => {
    if (worker?.state === "installed") waitingWorker = worker;
    updateButton.hidden = !(navigatorObject.serviceWorker.controller && waitingWorker?.state === "installed");
  };
  const watchInstallingWorker = (worker) => {
    if (!worker) return;
    const updateVisibility = () => {
      if (worker.state === "installed") showWaitingUpdate(worker);
    };
    worker.addEventListener("statechange", updateVisibility);
    updateVisibility();
  };

  showWaitingUpdate();
  registration.addEventListener("updatefound", () => watchInstallingWorker(registration.installing));
  updateButton.addEventListener("click", () => {
    const waiting = registration.waiting?.state === "installed" ? registration.waiting : waitingWorker;
    if (waiting?.state !== "installed") {
      updateButton.hidden = true;
      return;
    }
    updateRequested = true;
    waiting.postMessage({ type: "PROMPTHUB_ACTIVATE_UPDATE" });
  });
  navigatorObject.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested || reloaded) return;
    reloaded = true;
    reload();
  });
  return registration;
}
