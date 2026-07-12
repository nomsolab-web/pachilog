import { Hono } from 'hono';
import { cors } from "hono/cors"
import { channelsRoute } from "./routes/channels";
import { rankings } from "./routes/rankings";
import { collect } from "./routes/collect";
import { machinesRoute } from "./routes/machines";
import { collectMachines } from "./routes/collect-machines";
import { weekly } from "./routes/weekly";

const app = new Hono()
  .basePath('api')
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }, 200))
  .get('/health', (c) => c.json({ status: 'ok' }, 200))
  .route('/channels', channelsRoute)
  .route('/rankings', rankings)
  .route('/collect', collect)
  .route('/machines', machinesRoute)
  .route('/collect-machines', collectMachines)
  .route('/weekly', weekly);

export type AppType = typeof app;
export default app;
