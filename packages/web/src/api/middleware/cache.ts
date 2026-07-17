import { createHash } from "node:crypto";
import { createMiddleware } from "hono/factory";

const READ_ONLY_API_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const NO_STORE = "no-store";

const CACHEABLE_GET_PREFIXES = ["/api/channels", "/api/rankings", "/api/machines", "/api/videos", "/api/weekly"];
const NO_STORE_PREFIXES = ["/api/collect", "/api/collect-machines"];

export const httpCache = createMiddleware(async (c, next) => {
  await next();

  const path = c.req.path;
  const method = c.req.method.toUpperCase();

  if (method !== "GET" || isNoStorePath(path)) {
    c.res.headers.set("Cache-Control", NO_STORE);
    return;
  }

  if (!isCacheableGetPath(path) || c.res.status !== 200) {
    c.res.headers.set("Cache-Control", NO_STORE);
    return;
  }

  c.res.headers.set("Cache-Control", READ_ONLY_API_CACHE);

  if (c.res.headers.has("ETag")) return;

  const body = await c.res.clone().text();
  const etag = createWeakEtag(body);
  c.res.headers.set("ETag", etag);

  if (c.req.header("if-none-match") === etag) {
    c.res = new Response(null, {
      status: 304,
      headers: c.res.headers,
    });
  }
});

function isCacheableGetPath(path: string) {
  if (path.endsWith("/votes") || path.includes("/votes/")) return false;
  return CACHEABLE_GET_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isNoStorePath(path: string) {
  if (path.endsWith("/votes") || path.includes("/votes/")) return true;
  return NO_STORE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function createWeakEtag(body: string) {
  const hash = createHash("sha1").update(body).digest("base64url");
  return `W/"${hash}"`;
}
