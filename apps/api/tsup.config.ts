import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/migrate.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  splitting: false,
  target: "node22",
  noExternal: ["@pathweave/game"],
});
