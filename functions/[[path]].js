import worker from "../src/cloudflare/worker.mjs";

export async function onRequest({ request, env }) {
  return worker.fetch(request, env);
}

