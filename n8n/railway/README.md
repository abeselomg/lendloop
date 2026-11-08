# Hosting n8n on Railway

Hand-off for running the LendLoop automation on Railway so a Convex Cloud (production) deployment can reach it.
Result: `https://<railway-domain>/webhook/lendloop-loan-event` receives signed events from Convex, and the daily
reminder workflow calls back to `https://<prod>.convex.site`.

You need: a Railway account, a deployed Convex production deployment (`npx convex deploy`), and optionally a Resend API key.

## 1. Create the services

1. New project, then **Deploy from Docker image**: `docker.n8n.io/n8nio/n8n:2.46.6` (keep it pinned).
2. Add the **PostgreSQL** plugin to the same project.
3. On the n8n service, open Settings, Networking and **Generate Domain**. Note it as `<railway-domain>`.
4. Optional: add a Volume mounted at `/home/node/.n8n` (n8n keeps a config file there; the encryption key is
   supplied by env var below, so the database is the real state).

## 2. Variables on the n8n service

Use Railway variable references (`${{Postgres.PGHOST}}`) for the database.

| Variable | Value |
| --- | --- |
| `DB_TYPE` | `postgresdb` |
| `DB_POSTGRESDB_HOST` | `${{Postgres.PGHOST}}` |
| `DB_POSTGRESDB_PORT` | `${{Postgres.PGPORT}}` |
| `DB_POSTGRESDB_DATABASE` | `${{Postgres.PGDATABASE}}` |
| `DB_POSTGRESDB_USER` | `${{Postgres.PGUSER}}` |
| `DB_POSTGRESDB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32`. **Generate once, store it in a password manager, never change it.** Losing it makes stored credentials unreadable |
| `N8N_HOST` | `<railway-domain>` |
| `N8N_PROTOCOL` | `https` |
| `N8N_PORT` | `5678` |
| `WEBHOOK_URL` | `https://<railway-domain>/` |
| `N8N_RUNNERS_ENABLED` | `true` |
| `NODE_FUNCTION_ALLOW_BUILTIN` | `crypto` |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` |
| `N8N_DIAGNOSTICS_ENABLED` | `false` |
| `GENERIC_TIMEZONE` / `TZ` | `UTC` |
| `CONVEX_TO_N8N_SECRET` | Same value as on the Convex prod deployment |
| `N8N_TO_CONVEX_SECRET` | Same value as on the Convex prod deployment |
| `LENDLOOP_CONVEX_SITE_URL` | `https://<prod>.convex.site` |
| `LENDLOOP_EMAIL_ENABLED` | `false` for mock mode, `true` to send via Resend |
| `LENDLOOP_EMAIL_FROM` | `LendLoop <onboarding@resend.dev>` (or an address on your verified Resend domain) |

Do **not** set `N8N_SECURE_COOKIE=false`; Railway terminates HTTPS. Use different secret values than your local ones.
Deploy the service and wait for it to be healthy, then open `https://<railway-domain>` and **create the owner
account** (use a strong password; the editor is internet-facing).

## 3. Import the workflows

The workflow files live in `n8n/workflows/` with stable ids (`LLLoanNotify0001`, `LLOverdueRemind1`,
`LLErrorHandler01`) and the main two reference the error handler by id. Preferred path keeps the ids:

**Railway shell / CLI (keeps ids).** Get the three JSON files onto the container (for example `railway ssh`, then
paste them into `/tmp/workflows/`, or build a small image that copies them in). Then:

```bash
n8n import:workflow --separate --input=/tmp/workflows
n8n publish:workflow --id=LLErrorHandler01
n8n publish:workflow --id=LLLoanNotify0001
n8n publish:workflow --id=LLOverdueRemind1
```

Restart the service afterwards so activation takes effect.

**UI import (assigns new ids).** Workflows, then Import from File, for each of the three files. Because ids change,
the error-workflow link breaks: open **Loan notification** and **Overdue reminders**, Settings, **Error Workflow**,
and select "LendLoop - Error handler" in each. Also re-select the credential in the "Send via Resend" nodes if the
editor shows it missing. Then set all three workflows to **Active**, starting with "LendLoop - Error handler": an inactive error handler never runs, so failures would go unrecorded.

## 4. Create the Resend credential (skip in mock mode)

1. Credentials, Create, **Header Auth**.
2. Name it exactly `Resend API`. Header name `Authorization`, value `Bearer <RESEND_API_KEY>`.
3. Open the "Send via Resend" node in both main workflows and make sure it uses this credential.
4. Set `LENDLOOP_EMAIL_ENABLED=true` and redeploy. Without a verified Resend domain, mail only reaches the Resend
   account owner; other recipients get a 4xx, which is recorded as `notification_failed` and mock-logged.

## 5. Point Convex at n8n

```bash
npx convex env set N8N_LOAN_EVENT_WEBHOOK_URL https://<railway-domain>/webhook/lendloop-loan-event --prod
npx convex env set CONVEX_TO_N8N_SECRET <same as n8n> --prod
npx convex env set N8N_TO_CONVEX_SECRET <same as n8n> --prod
```

## 6. Verify

1. From the app, create a request on someone else's tool. n8n **Executions** should show a successful
   "Loan notification" run and the loan timeline should show the webhook delivery and a notification row.
2. Open "Overdue reminders" and click **Execute workflow**; with no overdue loans it ends as a clean no-op.
3. If the timeline shows `webhook_failed`, check the secrets match, the workflows are Active, and the URL is the
   production webhook (`/webhook/...`, not `/webhook-test/...`).

## Notes

- Railway restarts keep working because state is in Postgres and the encryption key is an env var.
- Put the editor behind SSO or restrict it; only `/webhook/lendloop-loan-event` has to be public.
- Rotation steps are in [`../README.md`](../README.md).
