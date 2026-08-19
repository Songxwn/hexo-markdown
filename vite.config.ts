import { builtinModules } from "node:module";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const cjsOutput = {
  format: "cjs" as const,
  entryFileNames: "[name].cjs",
  chunkFileNames: "[name].cjs",
};

const mainExternals = [
  "electron",
  "ssh2",
  /\.node$/,
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: mainExternals,
              output: cjsOutput,
            },
          },
        },
      },
      preload: {
        input: resolve("electron/preload.ts"),
        vite: {
          build: {
            rollupOptions: {
              external: ["electron", ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
              output: cjsOutput,
            },
          },
        },
      },
    }),
  ],
});
