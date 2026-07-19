import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "bun:test": "vitest",
      "@": path.resolve(__dirname, "./src/web"),
    },
  },
  test: {
    globals: true,
  },
});
