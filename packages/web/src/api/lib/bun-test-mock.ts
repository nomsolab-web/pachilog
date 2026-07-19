import { describe, test } from "node:test";
import assert from "node:assert";

export { describe, test };

export function expect(actual: any) {
  return {
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected);
    },
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toContain(expected: any) {
      assert.ok(actual.includes(expected));
    },
    sort() {
      if (Array.isArray(actual)) {
        actual.sort();
      }
      return this;
    }
  };
}
