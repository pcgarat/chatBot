import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function serveStaticAlias() {
  return {
    name: "serve-static-alias",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith("/static/")) {
          req.url = req.url.slice("/static".length) || "/";
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), serveStaticAlias()],
  base: command === "build" ? "/static/" : "/",
  publicDir: "public",
  build: {
    outDir: "../app/static",
    emptyOutDir: true,
    minify: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "js/main.js",
        chunkFileNames: (chunk) =>
          chunk.name === "app" ? "js/app.js" : "js/[name].js",
        assetFileNames: (asset) => {
          if (asset.name && asset.name.endsWith(".css")) {
            return "css/style.css";
          }
          return "assets/[name][extname]";
        },
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.endsWith("/src/app.js")) {
            return "app";
          }
          return undefined;
        },
      },
    },
  },
  esbuild: {
    keepNames: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
  },
}));
