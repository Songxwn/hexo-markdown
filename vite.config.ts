import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import * as ts from "typescript";
import { defineConfig, type Plugin } from "vite";
import electron from "vite-plugin-electron/simple";

const preloadSource = resolve("electron/preload.ts");
const preloadOut = resolve("dist-electron/preload.cjs");

function emitPreloadCjs(): void {
  const source = readFileSync(preloadSource, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    fileName: preloadSource,
  });
  mkdirSync(dirname(preloadOut), { recursive: true });
  writeFileSync(preloadOut, outputText);
}

function preloadCjs(): Plugin {
  return {
    name: "preload-cjs",
    buildStart() {
      this.addWatchFile(preloadSource);
      emitPreloadCjs();
    },
    configureServer(server) {
      server.watcher.add(preloadSource);
      server.watcher.on("change", (file) => {
        if (resolve(file) === preloadSource) {
          emitPreloadCjs();
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/mermaid")) return "mermaid";
          if (id.includes("node_modules/highlight.js")) return "highlight";
        },
      },
    },
  },
  plugins: [
    react(),
    preloadCjs(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: ["ssh2", "@aws-sdk/client-s3", /\.node$/],
            output: {
              format: "es",
              entryFileNames: "[name].js",
              chunkFileNames: "[name].js",
              inlineDynamicImports: true,
            },
            },
          },
        },
      },
    }),
  ],
});
