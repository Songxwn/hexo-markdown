import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { resolve } from "node:path";

const cjsOutput = {
  format: "cjs" as const,
  entryFileNames: "[name].cjs",
  chunkFileNames: "[name].cjs",
};

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
              output: cjsOutput,
            },
          },
        },
      },
    }),
  ],
});
