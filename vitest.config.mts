import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", env: { FIELD_ENCRYPTION_KEYS: "v1=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", ALLOWED_DOMAIN: "exemplo.com.br" } },
});
