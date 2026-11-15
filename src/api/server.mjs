import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequestHandler } from "./handler.mjs";

const ASSET_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
});

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
});

function webRequestFromNode(request) {
  const protocol = request.socket.encrypted ? "https:" : "http:";
  const host = request.headers.host ?? "localhost";
  const init = { method: request.method, headers: new Headers(request.headers) };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = new ReadableStream({
      start(controller) {
        request.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
        request.on("end", () => controller.close());
        request.on("error", (error) => controller.error(error));
      },
      cancel() { request.destroy(); },
    });
    init.duplex = "half";
  }
  return new Request(new URL(request.url ?? "/", `${protocol}//${host}`), init);
}

function writeResponse(response, nodeResponse) {
  nodeResponse.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  return response.arrayBuffer().then((body) => nodeResponse.end(Buffer.from(body)));
}

export function createHttpServer({ config, controlPlane, auth, projectService = null, promptDesigner = null, promptLibrary = null, errorLearning = null, logger = console, assetRoot = join(process.cwd(), "src", "pwa") } = {}) {
  const handleRequest = createRequestHandler({ config, controlPlane, auth, projectService, promptDesigner, promptLibrary, errorLearning, logger });
  return createServer(async (request, response) => {
    try {
      const webRequest = webRequestFromNode(request);
      const apiResponse = await handleRequest(webRequest);
      if (apiResponse) return await writeResponse(apiResponse, response);
      if (request.method === "GET" || request.method === "HEAD") {
        const pathname = new URL(webRequest.url).pathname;
        const assetName = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
        const normalized = normalize(assetName);
        if (normalized.startsWith("..") || normalized.includes("\\")) {
          response.writeHead(404, SECURITY_HEADERS);
          return response.end("Not found");
        }
        try {
          const filePath = join(assetRoot, normalized);
          const content = await readFile(filePath);
          response.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": ASSET_TYPES[extname(filePath)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
          return response.end(request.method === "HEAD" ? undefined : content);
        } catch {
          response.writeHead(404, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
          return response.end("Not found");
        }
      }
      response.writeHead(405, { ...SECURITY_HEADERS, Allow: "GET, HEAD, POST, PUT, DELETE" });
      response.end("Method not allowed");
    } catch (error) {
      logger.error?.({ event: "request_failed", error_class: error?.name ?? "Error" });
      response.writeHead(500, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: "Unexpected internal error" }));
    }
  });
}
