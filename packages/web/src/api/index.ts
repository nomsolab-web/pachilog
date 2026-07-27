import { Hono } from "hono";
import { cors } from "hono/cors";
import { createChannelsRoute } from "./routes/channels";
import { createRankingsRoute } from "./routes/rankings";
import { createCollectRoute } from "./routes/collect";
import { createMachinesRoute } from "./routes/machines";
import { createCollectMachinesRoute } from "./routes/collect-machines";
import { createVideosRoute } from "./routes/videos";
import { createWeeklyRoute } from "./routes/weekly";
import { httpCache } from "./middleware/cache";
import { db as defaultDb } from "./database";

export function createApp(db = defaultDb) {
  const app = new Hono()
    .basePath("api")
    .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
    .use(httpCache)
    .get("/ping", (c) => c.json({ message: `Pong! ${Date.now()}` }, 200))
    .get("/health", (c) => c.json({ status: "ok" }, 200))
    .route("/channels", createChannelsRoute(db))
    .route("/rankings", createRankingsRoute(db))
    .route("/collect", createCollectRoute(db))
    .route("/machines", createMachinesRoute(db))
    .route("/collect-machines", createCollectMachinesRoute(db))
    .route("/videos", createVideosRoute(db))
    .route("/weekly", createWeeklyRoute(db));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_server_error", message: err.message }, 500);
  });

  return app;
}

const app = createApp(defaultDb);
export type AppType = typeof app;
export default app;
