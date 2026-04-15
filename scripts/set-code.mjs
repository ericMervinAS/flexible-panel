/**
 * Set the daily access code.
 *
 * Usage: node scripts/set-code.mjs <6-digit-code>
 *
 * One-time .env.local setup:
 *   VERCEL_TOKEN=<vercel.com/account/tokens>
 *   VERCEL_PROJECT_ID=<project Settings → General>
 *   VERCEL_DEPLOY_HOOK=<project Settings → Git → Deploy Hooks>
 *   VERCEL_TEAM_ID=<only needed for team projects>
 */

import { pbkdf2 } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

// Must match SALT in src/components/AccessGate.tsx
const SALT = "aftershoot-arc-v1";

// ── Args ──────────────────────────────────────────────────────────────────────
const code = process.argv[2];

if (!code || !/^\d{6}$/.test(code)) {
  console.error("\n  Usage:   node scripts/set-code.mjs <6-digit-code>");
  console.error("  Example: node scripts/set-code.mjs 482910\n");
  process.exit(1);
}

// ── Hash ──────────────────────────────────────────────────────────────────────
const buf = await pbkdf2Async(code, SALT, 100_000, 32, "sha256");
const hash = buf.toString("hex");

// ── .env.local helpers ────────────────────────────────────────────────────────
const envPath = ".env.local";

const readEnv = () => {
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
  );
};

const writeEnvKey = (key, value) => {
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  if (content.includes(`${key}=`)) {
    content = content.replace(new RegExp(`${key}=.*`), line);
  } else {
    content = content ? content.trimEnd() + "\n" + line + "\n" : line + "\n";
  }
  writeFileSync(envPath, content);
};

// ── Update local .env.local ───────────────────────────────────────────────────
writeEnvKey("VITE_ACCESS_CODE_HASH", hash);
console.log("\n  ✓ Local .env.local updated.");

// ── Read credentials ──────────────────────────────────────────────────────────
const env = readEnv();
const VERCEL_TOKEN = env["VERCEL_TOKEN"];
const VERCEL_PROJECT_ID = env["VERCEL_PROJECT_ID"];
const VERCEL_DEPLOY_HOOK = env["VERCEL_DEPLOY_HOOK"];
const VERCEL_TEAM_ID = env["VERCEL_TEAM_ID"];

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID || !VERCEL_DEPLOY_HOOK) {
  console.log("  Skipping Vercel deploy (no credentials in .env.local).");
  console.log("  Restart the dev server to use the new code locally.\n");
  process.exit(0);
}

// ── Update env var on Vercel ──────────────────────────────────────────────────
const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
const headers = {
  Authorization: `Bearer ${VERCEL_TOKEN}`,
  "Content-Type": "application/json",
};

console.log("  Updating VITE_ACCESS_CODE_HASH on Vercel…");

const listRes = await fetch(
  `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env${teamQuery}`,
  { headers }
);
if (!listRes.ok) {
  console.error(`\n  Vercel API error ${listRes.status}: ${await listRes.text()}\n`);
  process.exit(1);
}

const { envs } = await listRes.json();
const existing = envs?.find((e) => e.key === "VITE_ACCESS_CODE_HASH");

if (existing) {
  const patchRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${existing.id}${teamQuery}`,
    { method: "PATCH", headers, body: JSON.stringify({ value: hash }) }
  );
  if (!patchRes.ok) {
    console.error(`\n  Failed to update env var: ${patchRes.status} ${await patchRes.text()}\n`);
    process.exit(1);
  }
} else {
  const createRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env${teamQuery}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        key: "VITE_ACCESS_CODE_HASH",
        value: hash,
        type: "plain",
        target: ["production", "preview"],
      }),
    }
  );
  if (!createRes.ok) {
    console.error(`\n  Failed to create env var: ${createRes.status} ${await createRes.text()}\n`);
    process.exit(1);
  }
}

console.log("  ✓ Vercel env var updated.");

// ── Trigger fresh build via deploy hook ───────────────────────────────────────
console.log("  Triggering fresh build…");

const hookRes = await fetch(VERCEL_DEPLOY_HOOK, { method: "POST" });
if (!hookRes.ok) {
  console.error(`\n  Deploy hook failed: ${hookRes.status} ${await hookRes.text()}\n`);
  process.exit(1);
}

console.log("  ✓ Build triggered. New code will be live in ~1 minute.\n");
