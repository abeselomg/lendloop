#!/usr/bin/env node
// Imports the LendLoop workflows (and the Resend credential, if RESEND_API_KEY is set)
// into the running n8n container, activates the main workflows, and restarts n8n.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const n8nDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const compose = join(n8nDir, "docker-compose.yml");
const envFile = join(n8nDir, ".env");

if (!existsSync(envFile)) {
  console.error("n8n/.env not found. Copy n8n/.env.example to n8n/.env and fill it in first.");
  process.exit(1);
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

const env = parseEnv(readFileSync(envFile, "utf8"));
const base = ["compose", "-f", compose, "--env-file", envFile];
const dc = (args, opts = {}) => execFileSync("docker", [...base, ...args], { stdio: "inherit", ...opts });
const n8n = (...args) => dc(["exec", "-T", "n8n", "n8n", ...args]);

try {
  console.log("Importing workflows...");
  n8n("import:workflow", "--separate", "--input=/home/node/workflows");

  if (env.RESEND_API_KEY) {
    console.log("Importing Resend credential (piped via stdin, never written to host disk)...");
    const creds = [
      {
        id: "LLResendApiKey01",
        name: "Resend API",
        type: "httpHeaderAuth",
        data: { name: "Authorization", value: `Bearer ${env.RESEND_API_KEY}` },
      },
    ];
    dc(
      [
        "exec",
        "-T",
        "n8n",
        "sh",
        "-c",
        "cat > /tmp/ll-creds.json && n8n import:credentials --input=/tmp/ll-creds.json; rc=$?; rm -f /tmp/ll-creds.json; exit $rc",
      ],
      { input: JSON.stringify(creds), stdio: ["pipe", "inherit", "inherit"] },
    );
  } else {
    console.log("RESEND_API_KEY not set: skipping credential import (mock mode).");
  }

  console.log("Activating workflows...");
  n8n("update:workflow", "--id=LLLoanNotify0001", "--active=true");
  n8n("update:workflow", "--id=LLOverdueRemind1", "--active=true");

  console.log("Restarting n8n so activation takes effect...");
  dc(["restart", "n8n"]);
} catch (err) {
  console.error(
    "\nImport failed. Is the stack running (`npm run n8n:up`) and the owner account created at http://localhost:5678?",
  );
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

console.log(`
Done. Next steps:
  1. Open http://localhost:5678 and check Workflows (3 imported, 2 active).
  2. Set N8N_LOAN_EVENT_WEBHOOK_URL in Convex to http://host.docker.internal:5678/webhook/lendloop-loan-event
     (or your public URL + /webhook/lendloop-loan-event), plus CONVEX_TO_N8N_SECRET / N8N_TO_CONVEX_SECRET.
  3. Watch runs under Executions; mock notifications show in: docker compose -f n8n/docker-compose.yml logs -f n8n
`);
