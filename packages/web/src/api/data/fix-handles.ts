/**
 * One-off correction for handles that failed to resolve in the first collection run.
 * Run with: bun run packages/web/src/api/data/fix-handles.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels } from "../database/schema";

const FIXES: { oldHandle: string; newHandle: string; note?: string }[] = [
  { oldHandle: "@surparchi_station", newHandle: "@isomaru-yoshiki" },
  { oldHandle: "@surupachistation", newHandle: "@janjan-renjiro" },
  { oldHandle: "@sakuratakatora", newHandle: "@桜鷹虎さくらたかとら" },
  { oldHandle: "@dmm_pachitown", newHandle: "@DMMpachitown" },
  { oldHandle: "@nicchoku_shimada", newHandle: "@simada_obasan" },
  { oldHandle: "@yakinake_pachi", newHandle: "@yakinn" },
  { oldHandle: "@gomikuzu_neet", newHandle: "@gkneet_life" },
  { oldHandle: "@teraiicchaku", newHandle: "@terai_bakuretsu" },
  { oldHandle: "@1gametv", newHandle: "@1gametv744" },
  { oldHandle: "@dechau_web", newHandle: "@dechauWEBTV" },
];

const DEACTIVATE_HANDLES = ["@isomaru", "@higegenjin"];

async function main() {
  for (const fix of FIXES) {
    const res = await db.update(channels).set({ handle: fix.newHandle }).where(eq(channels.handle, fix.oldHandle));
    console.log(`updated ${fix.oldHandle} -> ${fix.newHandle}`, res);
  }
  for (const handle of DEACTIVATE_HANDLES) {
    await db.update(channels).set({ active: false }).where(eq(channels.handle, handle));
    console.log(`deactivated duplicate: ${handle}`);
  }
}

main().then(() => process.exit(0));
