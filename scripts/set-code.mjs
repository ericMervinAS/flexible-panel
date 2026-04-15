/**
 * Set the daily access code — locally and/or on Vercel.
 *
 * Usage:
 *   node scripts/set-code.mjs <6-digit-code>            # update .env.local only
 *   node scripts/set-code.mjs <6-digit-code> --deploy   # update Vercel + redeploy
 *
 * One-time Vercel setup (add these to .env.local — never committed):
 *   VERCEL_TOKEN=<your token from vercel.com/account/tokens>
 *   VERCEL_PROJECT_ID=<from Vercel project Settings → General>
 *   VERCEL_TEAM_ID=<team slug or id — only needed for team projects>
 */

import { pbkdf2 } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

// Must match SALT in src/components/AccessGate.tsx
const SALT = "aftershoot-arc-v1";

// ── Args ──────────────────────────────────────────────────────────────────────
const code = process.argv[2];
const deploy = process.argv.includes("--deploy");

if (!code || !/^\d{6}$/.test(code)) {
  console.error("\n  Usage:   node scripts/set-code.mjs <6-digit-code> [--deploy]");
  console.error("  Example: node scripts/set-code.mjs 482910 --deploy\n");
  process.exit(1);
}

// ── Hash ──────────────────────────────────────────────────────────────────────
const buf = await pbkdf2Async(code, SALT, 100_000, 32, "sha256");
const hash = buf.toString("hex");

// ── Read .env.local ───────────────────────────────────────────────────────────
const envPath = ".env.local";
const readEnv = () => {
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
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
if (!deploy) {
  console.log("  Restart the dev server for the change to take effect.\n");
  process.exit(0);
}

// ── Deploy to Vercel ──────────────────────────────────────────────────────────
const env = readEnv();
const VERCEL_TOKEN = env["VERCEL_TOKEN"];
const VERCEL_PROJECT_ID = env["VERCEL_PROJECT_ID"];
const VERCEL_TEAM_ID = env["VERCEL_TEAM_ID"]; // optional

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error("\n  Missing Vercel credentials in .env.local.");
  console.error("  Add these lines to .env.local:");
  console.error("    VERCEL_TOKEN=<from vercel.com/account/tokens>");
  console.error("    VERCEL_PROJECT_ID=<from project Settings → General>\n");
  process.exit(1);
}

const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
const headers = {
  Authorization: `Bearer ${VERCEL_TOKEN}`,
  "Content-Type": "application/json",
};

// 1. Fetch existing env vars to find the ID of VITE_ACCESS_CODE_HASH
console.log("  Fetching Vercel project env vars…");
const listRes = await fetch(
  `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env${teamQuery}`,
  { headers }
);
if (!listRes.ok) {
  console.error(`\n  Vercel API error: ${listRes.status} ${await listRes.text()}\n`);
  process.exit(1);
}
const { envs } = await listRes.json();
const existing = envs?.find((e) => e.key === "VITE_ACCESS_CODE_HASH");

// 2. Create or update the env var
if (existing) {
  console.log("  Updating VITE_ACCESS_CODE_HASH on Vercel…");
  const patchRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${existing.id}${teamQuery}`,
    { method: "PATCH", headers, body: JSON.stringify({ value: hash }) }
  );
  if (!patchRes.ok) {
    console.error(`\n  Failed to update env var: ${patchRes.status} ${await patchRes.text()}\n`);
    process.exit(1);
  }
} else {
  console.log("  Creating VITE_ACCESS_CODE_HASH on Vercel…");
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

// 3. Trigger a redeployment (redeploy latest production deployment)
console.log("  Triggering redeployment…");
const deploysRes = await fetch(
  `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=production&limit=1${VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : ""}`,
  { headers }
);
if (!deploysRes.ok) {
  console.error(`\n  Could not fetch deployments: ${deploysRes.status}\n`);
  process.exit(1);
}
const { deployments } = await deploysRes.json();
const latest = deployments?.[0];
if (!latest) {
  console.error("\n  No existing deployment found to redeploy.\n");
  process.exit(1);
}

const redeployRes = await fetch(
  `https://api.vercel.com/v13/deployments${teamQuery}`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: latest.name,
      deploymentId: latest.uid,
      target: "production",
    }),
  }
);
if (!redeployRes.ok) {
  console.error(`\n  Redeployment failed: ${redeployRes.status} ${await redeployRes.text()}\n`);
  process.exit(1);
}

const newDeploy = await redeployRes.json();
console.log(`  ✓ Redeployment triggered → ${newDeploy.url ?? "check Vercel dashboard"}`);
console.log("  New code will be live in ~30–60 seconds.\n");
