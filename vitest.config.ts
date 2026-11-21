import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Lets tests use the same "@/lib/..." imports as the app.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Creates the tables in the test database before the database tests run.
    globalSetup: ["tests/db/globalSetup.ts"],
  },
});
