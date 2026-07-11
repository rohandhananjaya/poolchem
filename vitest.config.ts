import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Mirror the tsconfig `@/*` -> `src/*` path alias so tests can import modules
// the same way application code does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./src/test/__mocks__/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/generated/**",
        "src/**/*.test.*",
        "src/**/*.d.ts",
        "src/test/**",
      ],
    },
  },
});
