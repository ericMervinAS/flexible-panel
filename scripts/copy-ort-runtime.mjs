#!/usr/bin/env node
// Copies the onnxruntime-web runtime (JS + WASM) into models/ort/ so the
// retinaface-eval.html page works as a static, deployable bundle without
// fetching anything from a CDN at runtime.
//
// Run after `npm install` (wired up via package.json `postinstall`).

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = dirname(__dirname);
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dst = join(root, "models", "ort");
const publicDst = join(root, "public", "ort");

if (!existsSync(src)) {
  console.error(`[copy-ort-runtime] missing source: ${src}`);
  console.error("                   run `npm install` first.");
  process.exit(1);
}

// Only ship what the page actually loads: the non-threaded JSEP runtime.
// (Threaded variants need cross-origin isolation headers on the host, which
// most static hosts don't provide by default.)
const ALLOW = new Set([
  "ort.min.js",
  "ort.min.js.map",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
]);

for (const dir of [dst, publicDst]) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

let copied = 0;
for (const name of readdirSync(src)) {
  if (!ALLOW.has(name)) continue;
  copyFileSync(join(src, name), join(dst, name));
  copyFileSync(join(src, name), join(publicDst, name));
  copied++;
}

console.log(`[copy-ort-runtime] copied ${copied} files → ${dst} and ${publicDst}`);

// ── face-api model weights → public/face-api-models/ ──────────────────────────
const faceApiSrc = join(root, "node_modules", "@vladmandic", "face-api", "model");
const faceApiDst = join(root, "public", "face-api-models");

if (existsSync(faceApiSrc)) {
  if (existsSync(faceApiDst)) rmSync(faceApiDst, { recursive: true, force: true });
  mkdirSync(faceApiDst, { recursive: true });
  let faCopied = 0;
  for (const name of readdirSync(faceApiSrc)) {
    copyFileSync(join(faceApiSrc, name), join(faceApiDst, name));
    faCopied++;
  }
  console.log(`[copy-ort-runtime] copied ${faCopied} face-api model files → ${faceApiDst}`);
}
