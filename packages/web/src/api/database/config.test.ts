import { describe, expect, test } from "bun:test";
import { requireDatabaseUrl } from "./config";

describe("database configuration", () => {
  test("rejects a missing DATABASE_URL with an explicit error", () => {
    expect(() => requireDatabaseUrl(undefined)).toThrow("DATABASE_URL is required");
  });

  test("returns the configured database URL", () => {
    expect(requireDatabaseUrl("libsql://example.test")).toBe("libsql://example.test");
  });
});
