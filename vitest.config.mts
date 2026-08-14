import { defineConfig } from "vitest/config";

// The math core is pure and DOM-free, so the default node environment is
// enough. `tsconfigPaths` resolves the "@/..." aliases from tsconfig.json.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
