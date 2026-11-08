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
A request with a missing, wrong or stale signature gets **401** from the "Respond 401" node and is dropped without raising
an error (so unauthenticated traffic cannot flood the error workflow); Convex records that attempt as failed and retries/flags it.
The container port is bound to 127.0.0.1 only; expose it through a tunnel/reverse proxy if Convex Cloud must reach it.

## First start

1. `cp n8n/.env.example n8n/.env` and fill the secrets (`openssl rand -hex 32` for each). Use the same
   `CONVEX_TO_N8N_SECRET` / `N8N_TO_CONVEX_SECRET` values in the Convex deployment env.
2. `npm run n8n:up`, then `npm run n8n:import`. The CLI import works on a fresh instance without an owner account (verified on 2.46.6); create the owner at <http://localhost:5678> afterwards to use the editor and Executions view.
3. `npm run n8n:import` imports the workflows, imports the Resend credential (only if `RESEND_API_KEY` is set in `n8n/.env`; it is
   piped over stdin and never written to host disk), publishes the three workflows (the error handler must be published or n8n refuses to run it) and restarts n8n.
4. Point Convex at n8n: set `N8N_LOAN_EVENT_WEBHOOK_URL` to
   `http://localhost:5678/webhook/lendloop-loan-event` for a Convex backend running on the host (use
   `http://host.docker.internal:5678/webhook/lendloop-loan-event` only if Convex itself runs inside Docker, or your
   public URL for Convex Cloud), and the two secrets.

Set `LENDLOOP_EMAIL_ENABLED=false` (the default) to run fully offline: each "email" is logged as
`[LendLoop mock notification] {...}` visible in the n8n Executions view (verified on 2.46.6: they do not appear in `docker compose logs`).
With `true`, emails go through Resend; a 4xx from Resend falls back to a mock log and is recorded as `failed`, a 5xx or 429
is recorded the same way (`failed`, channel `mock`, so it shows on the loan timeline). After that row is written, the
"Raise on severe" node throws so the error workflow also reports it. Convex retries only when n8n fails to accept the
webhook (401/5xx before the 202); once n8n has answered 202, delivery problems are handled inside n8n.

## Where to look

- Executions: <http://localhost:5678> then each workflow, tab **Executions** (or sidebar Overview, Executions).
- Delivery history and automation errors are also written back to Convex (notifications, reminders, automation errors).
- Failures of the error-handler workflow itself (e.g. a secret mismatch returning 401 from `/n8n/automation-errors`) appear only in n8n Executions, since n8n does not run an error workflow for an error workflow.
- Retries: Resend and write-back HTTP nodes retry 3 times, 2 s apart. Convex also retries a webhook call that does not get a 2xx.

## Trigger the reminder workflow manually

Open "LendLoop – Overdue reminders" in the editor and click **Execute workflow**. Reminders are idempotent per
`loanId:date`, so re-running on the same day does not duplicate them in Convex.

## Rotating secrets

1. Generate a new value (`openssl rand -hex 32`).
2. Update it in `n8n/.env` and in the Convex deployment env (`CONVEX_TO_N8N_SECRET` / `N8N_TO_CONVEX_SECRET`).
3. `docker compose -f n8n/docker-compose.yml --env-file n8n/.env up -d` to recreate the container with new env.
4. For the Resend key: update `RESEND_API_KEY` in `n8n/.env` and re-run `npm run n8n:import`.
   Do not change `N8N_ENCRYPTION_KEY` after first start (stored credentials would become unreadable).

`RESEND_API_KEY` is import-time only: it is not passed to the container (no `env_file`); it lives only in the encrypted n8n credential.
