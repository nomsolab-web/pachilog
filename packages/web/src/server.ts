import app from "./api";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

const port = Number(process.env.PORT ?? 3000);
const distDir = `${import.meta.dir}/../dist`;
const indexPath = `${distDir}/index.html`;

const HASHED_ASSET_CACHE = "public, max-age=31536000, immutable";
const INDEX_CACHE = "no-cache";

const server = Bun.serve({
  port,
  idleTimeout: 255,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      try {
        return await app.fetch(request);
      } catch (err) {
        console.error(err);
        return Response.json({ error: "internal_server_error" }, { status: 500 });
      }
    }

    const filePath = getStaticFilePath(url.pathname);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return staticResponse(request, filePath, file, cacheControlForPath(url.pathname));
    }

    const index = Bun.file(indexPath);
    if (await index.exists()) {
      return staticResponse(request, indexPath, index, INDEX_CACHE, {
        "Content-Type": "text/html; charset=utf-8",
      });
    }

    return new Response("Build output not found. Run `bun run build` first.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
});

console.log(`Web server listening on http://localhost:${server.port}`);

function getStaticFilePath(pathname: string) {
  const cleanPath = decodeURIComponent(pathname)
    .replace(/^\/+/, "")
    .replaceAll("..", "");

  return cleanPath ? `${distDir}/${cleanPath}` : indexPath;
}

async function staticResponse(
  request: Request,
  filePath: string,
  file: Bun.BunFile,
  cacheControl: string,
  extraHeaders: HeadersInit = {},
) {
  const metadata = await stat(filePath);
  const lastModified = metadata.mtime.toUTCString();
  const etag = createStaticEtag(filePath, metadata.size, metadata.mtimeMs);
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", cacheControl);
  headers.set("ETag", etag);
  headers.set("Last-Modified", lastModified);

  if (isFresh(request, etag, metadata.mtimeMs)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(file, { headers });
}

function cacheControlForPath(pathname: string) {
  if (pathname === "/" || pathname === "/index.html") return INDEX_CACHE;
  if (isHashedAsset(pathname)) return HASHED_ASSET_CACHE;
  return INDEX_CACHE;
}

function isHashedAsset(pathname: string) {
  return /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(pathname);
}

function createStaticEtag(filePath: string, size: number, mtimeMs: number) {
  const hash = createHash("sha1").update(`${filePath}:${size}:${mtimeMs}`).digest("base64url");
  return `W/"${hash}"`;
}

function isFresh(request: Request, etag: string, mtimeMs: number) {
  if (request.headers.get("if-none-match") === etag) return true;

  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) return false;

  const since = Date.parse(ifModifiedSince);
  return Number.isFinite(since) && Math.floor(mtimeMs / 1000) <= Math.floor(since / 1000);
}
