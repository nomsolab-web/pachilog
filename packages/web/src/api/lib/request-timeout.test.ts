import { describe, expect, test } from "bun:test";
import { disableCollectionRequestTimeout } from "./request-timeout";

describe("collection request timeout", () => {
  test("disables timeout for collect-machines/run", () => {
    const calls: unknown[] = [];
    const request = new Request("http://localhost/api/collect-machines/run");
    expect(disableCollectionRequestTimeout("/api/collect-machines/run", request, { timeout: (...args) => calls.push(args) })).toBe(true);
    expect(calls).toEqual([[request, 0]]);
  });

  test("disables timeout for collect-machines/track", () => {
    const calls: unknown[] = [];
    const request = new Request("http://localhost/api/collect-machines/track");
    expect(disableCollectionRequestTimeout("/api/collect-machines/track", request, { timeout: (...args) => calls.push(args) })).toBe(true);
    expect(calls).toEqual([[request, 0]]);
  });

  test("does not disable timeout for normal APIs", () => {
    const calls: unknown[] = [];
    const request = new Request("http://localhost/api/videos/trending");
    expect(disableCollectionRequestTimeout("/api/videos/trending", request, { timeout: (...args) => calls.push(args) })).toBe(false);
    expect(calls).toEqual([]);
  });
});
