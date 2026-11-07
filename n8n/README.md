# LendLoop n8n automation

Three workflows, exported as JSON in `n8n/workflows/` (secrets are never in them):

| File | Workflow | Trigger |
| --- | --- | --- |
| `loan-notification.json` | LendLoop – Loan notification | Webhook `POST /webhook/lendloop-loan-event`, called by Convex |
| `overdue-reminders.json` | LendLoop – Overdue reminders | Daily 09:00 UTC schedule |
| `error-handler.json` | LendLoop – Error handler | Error Trigger (set as `errorWorkflow` on the other two) |

Security, both directions: every request is signed `v1=HMAC-SHA256(secret, "<unix-ms>.<raw body>")` with a 5 minute tolerance.
Convex to n8n uses `CONVEX_TO_N8N_SECRET` (verified in the "Verify signature" Code node, timing-safe, raw bytes).
n8n to Convex uses `N8N_TO_CONVEX_SECRET` (Code nodes sign, Convex `/n8n/*` routes verify). Secrets are read via `$env`;
the Resend key is an n8n credential ("Resend API") referenced by id/name only.

## First start

1. `cp n8n/.env.example n8n/.env` and fill the secrets (`openssl rand -hex 32` for each). Use the same
   `CONVEX_TO_N8N_SECRET` / `N8N_TO_CONVEX_SECRET` values in the Convex deployment env.
2. `npm run n8n:up`, then open <http://localhost:5678> and **create the owner account**. The CLI import needs it.
3. `npm run n8n:import` imports the workflows, imports the Resend credential (only if `RESEND_API_KEY` is set; it is
   piped over stdin and never written to host disk), activates the two main workflows and restarts n8n.
4. Point Convex at n8n: set `N8N_LOAN_EVENT_WEBHOOK_URL` to
   `http://host.docker.internal:5678/webhook/lendloop-loan-event` (or your public URL), and the two secrets.

Set `LENDLOOP_EMAIL_ENABLED=false` (the default) to run fully offline: each "email" is logged as
`[LendLoop mock notification] {...}` and visible with `docker compose -f n8n/docker-compose.yml logs -f n8n`.
With `true`, emails go through Resend; a 4xx from Resend falls back to a mock log and is recorded as `failed`, a 5xx
raises an error (retried by Convex, reported by the error workflow).

## Where to look

- Executions: <http://localhost:5678> then each workflow, tab **Executions** (or sidebar Overview, Executions).
- Delivery history and automation errors are also written back to Convex (notifications, reminders, automation errors).
- Retries: Resend and write-back HTTP nodes retry 3 times, 2 s apart. Convex also retries non-2xx webhook responses.

## Trigger the reminder workflow manually

Open "LendLoop – Overdue reminders" in the editor and click **Execute workflow**. Reminders are idempotent per
`loanId:date`, so re-running on the same day does not duplicate them in Convex.

## Rotating secrets

1. Generate a new value (`openssl rand -hex 32`).
2. Update it in `n8n/.env` and in the Convex deployment env (`CONVEX_TO_N8N_SECRET` / `N8N_TO_CONVEX_SECRET`).
3. `docker compose -f n8n/docker-compose.yml --env-file n8n/.env up -d` to recreate the container with new env.
4. For the Resend key: update `RESEND_API_KEY` in `n8n/.env` and re-run `npm run n8n:import`.
   Do not change `N8N_ENCRYPTION_KEY` after first start (stored credentials would become unreadable).

Note: `.env` is passed to the container with `env_file`, so `RESEND_API_KEY` is also present in the container environment;
workflows never reference it.
