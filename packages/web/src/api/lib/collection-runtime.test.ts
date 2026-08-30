import { expect, test } from "bun:test";
import { COLLECTION_IDLE_TIMEOUT_SECONDS } from "./collection-runtime";

test("collection HTTP timeout remains above the historical 256 second boundary", () => {
  expect(COLLECTION_IDLE_TIMEOUT_SECONDS).toBeGreaterThan(256);
});
