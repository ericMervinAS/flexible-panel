import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Proxy /api/models/:name → actual model URL (kept in .env.local, never sent to client)
    {
      name: "proxy-model-downloads",
      configureServer(server) {
        const env = loadEnv(mode, process.cwd(), ""); // load ALL vars, not just VITE_
        const MODEL_URLS: Record<string, string> = {
          retinaface:  env.MODEL_URL_RETINAFACE  ?? "",
          arcface:     env.MODEL_URL_ARCFACE     ?? "",
          genderage:   env.MODEL_URL_GENDERAGE   ?? "",
          distraction: env.MODEL_URL_DISTRACTION ?? "",
          inpaint:     env.MODEL_URL_INPAINT     ?? "",
        };
        server.middlewares.use("/api/models", async (req, res, next) => {
          const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
          const url = MODEL_URLS[name];
          if (!url) { next(); return; }
          try {
            // Local file path (no protocol) — serve directly from disk
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
              const filePath = path.resolve(__dirname, url);
              if (!filePath.startsWith(path.resolve(__dirname))) { next(); return; }
              const stat = fs.statSync(filePath);
              res.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Cache-Control": "public, max-age=604800, immutable",
                "Content-Length": String(stat.size),
              });
              fs.createReadStream(filePath).pipe(res);
              return;
            }
            const upstream = await fetch(url);
            if (!upstream.ok) { res.writeHead(502); res.end(); return; }
            const buf = await upstream.arrayBuffer();
            res.writeHead(200, {
              "Content-Type": "application/octet-stream",
              "Cache-Control": "public, max-age=604800, immutable",
              "Content-Length": String(buf.byteLength),
            });
            res.end(Buffer.from(buf));
          } catch { res.writeHead(500); res.end(); }
        });
      },
    },
    // Serve models/ort/ WASM files at /ort/ so onnxruntime-web can find them
    {
      name: "serve-ort-wasm",
      configureServer(server) {
        const ortDir = path.resolve(__dirname, "models/ort");
        server.middlewares.use("/ort", (req, res, next) => {
          const urlPath = (req.url ?? "").split("?")[0];
          const filePath = path.join(ortDir, urlPath);
          // Guard against path traversal
          if (!filePath.startsWith(ortDir)) { next(); return; }
          try {
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) { next(); return; }
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader("Content-Type",
              ext === ".wasm" ? "application/wasm" :
              ext === ".mjs" || ext === ".js" ? "application/javascript" :
              "application/octet-stream",
            );
            res.setHeader("Content-Length", String(stat.size));
            fs.createReadStream(filePath).pipe(res);
          } catch { next(); }
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
