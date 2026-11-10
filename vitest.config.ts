import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    root: __dirname,
    include: ["api/**/*.test.ts", "shared/**/*.test.ts", "client/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
