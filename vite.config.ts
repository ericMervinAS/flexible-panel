import { defineConfig } from "vite";
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
