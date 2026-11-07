# LendLoop — Design

Neighborhood tool-lending board with automated notifications and reminders.
Take-home assignment for Fluence (Step 1). Deliverables: GitHub repo, exported
n8n workflow JSON, README (setup, env vars, architecture, security and
data-minimization decisions), production note.

## Intent

Neighbors list tools they are willing to lend, request to borrow from each
other for a date range, and the lender approves/declines and marks returns.
n8n handles the "robot" work: notifying the relevant person when a request is
created or changes status, and nagging borrowers daily about overdue loans.

The evaluators grade: code structure and clarity, security-minded thinking,
UX and practicality, integration design/reliability/error handling (n8n),
documentation and reasoning. Security and n8n reliability are where a naive
build loses points, so those get the most explicit design below.

## Decisions made by the user

| Decision | Choice |
|---|---|
| Notification channel | Real email via Resend (API key stored as an n8n credential). A mock-log fallback exists so the workflows run without a key. |
| Dev topology | Fully local: Convex local backend (`npx convex dev --local`), n8n in Docker. No tunnels. |
| Live demo | Yes: Next.js on Vercel (team `abeselomgs-projects`), Convex Cloud prod, n8n hosted on Railway/Render. |
| Accounts | User creates Clerk dev app, Convex account, Resend account. Keys pasted into `.env.local` / Convex env / n8n credential. |
| Repo | `abeselomg/lendloop`, private, created with `gh`. |
| Demo data | Idempotent seed command creates a "LendLoop Demo" neighbor owning ~8 sample tools. The user's own email is the admin via `ADMIN_EMAILS`; graders sign up with any email. |
| Resend domain | None. Email is delivered only to the Resend account owner's address. A provider rejection is recorded on the loan timeline as `notification_failed` and the workflow falls back to the mock-log channel, so automation stays visible in the app. |
| n8n hosting | Railway (user creates the account). Repo ships a Railway hand-off: image, Postgres, env vars, persisted `N8N_ENCRYPTION_KEY`, click-through steps. |

The original assignment text is transcribed in `docs/assignment.md`; the
Requirements section there is the acceptance checklist.

## Goals

1. Everything in the assignment's Requirements section, verbatim.
2. Role rules enforced in Convex functions; the UI only hides what the backend already forbids.
3. Two-way HMAC-signed, replay-resistant, idempotent integration between Convex and n8n, with retries and visible failures on both sides.
4. Bonus: per-loan automation timeline in the app ("Reminder sent 2 days ago").
5. A reviewer can run the whole thing locally from the README in ~15 minutes.

## Non-goals

- Payments, deposits, ratings, chat, images/uploads, search beyond category filter.
- Multi-tenancy / multiple neighborhoods. One board.
- Calendar-grade availability. We prevent overlapping *approved* loans on a tool; overlapping *pending* requests are allowed (lender picks one).
- Admin acting on other people's loans (approve/decline/return). Admin is view-all + remove listing + trusted-lender flag, exactly as specified. Least privilege.

## Anti-goals (would make this a failure even if it works)

- Secrets in code or in the exported workflow JSON.
- Backend that trusts the client's claimed user id or role.
- n8n workflow that swallows errors or double-sends on retry.
- Sending more personal data to n8n than the notification needs.

## Stack (pinned)

Next.js 16.4 (App Router, TS, Tailwind 4), Clerk `@clerk/nextjs` 7.9, Convex 1.49,
n8n 2.46.6 (Docker image `docker.n8n.io/n8nio/n8n:2.46.6`), Resend REST API,
vitest + convex-test. Node 20+.

## Architecture

```
Browser ──Clerk JWT──▶ Next.js (App Router)
   │                       │  (pages are thin; all data via Convex React hooks)
   └──────Convex client────┴──▶ Convex (queries/mutations/actions, RBAC lives here)
                                  │ outbox + scheduler              ▲ HTTP actions (signed)
                                  ▼                                 │
                        POST /webhook/lendloop-loan-event      GET /n8n/overdue-loans
                                  │                            POST /n8n/notifications
                                  ▼                            POST /n8n/reminders
                                n8n ── Resend ──▶ email        POST /n8n/automation-errors
                                  │  (error workflow on any failure) ─────────┘
```

Three n8n workflows: **Loan notification** (webhook-triggered), **Overdue
reminders** (daily schedule), **Error handler** (Error Trigger; reports failed
executions back to Convex so they show in the admin UI).

## Data model (Convex)

```
users          clerkId, email, name, imageUrl?, role: "admin"|"user",
               trustedLender: bool, createdAt
               idx: by_clerkId, by_email

tools          ownerId→users, name, category: enum, condition: enum,
               description, createdAt
               idx: by_owner, by_category

loans          toolId→tools, toolName (snapshot), borrowerId, lenderId,
               startDate, endDate ("YYYY-MM-DD"), note?,
               status: "pending"|"approved"|"declined"|"returned"|"cancelled",
               createdAt, updatedAt, returnedAt?, lastReminderAt?, reminderCount
               idx: by_tool, by_borrower, by_lender, by_status, by_tool_status

automationEvents   (outbox, Convex→n8n)
               loanId, type: "loan.requested"|"loan.approved"|"loan.declined"|
               "loan.returned"|"loan.cancelled", recipientUserId,
               status: "pending"|"delivered"|"failed", attempts, nextAttemptAt,
               lastError?, createdAt, deliveredAt?
               idx: by_loan, by_status

automationLog  (timeline shown in UI; also the idempotency ledger for write-backs)
               loanId?, kind: "webhook_delivered"|"webhook_failed"|
               "notification_sent"|"notification_failed"|"reminder_sent"|
               "workflow_error",
               source: "convex"|"n8n", message, idempotencyKey, createdAt,
               meta? (channel, providerMessageId, executionId …)
               idx: by_loan, by_key (unique by convention), by_kind
```

Categories: power_tools, hand_tools, garden, kitchen, camping, cleaning,
automotive, other. Conditions: new, good, fair, worn.

**Availability** is derived, not stored: a tool is "on loan" iff a loan with
status `approved` exists for it. Derived state can't drift.

**Tool removal** hard-deletes the tool; loans keep `toolName` so history and
in-flight loans still render. Pending requests on a removed tool are declined
(with a `loan.declined` event so the borrower hears about it).

## Roles & rules (enforced in `convex/lib/access.ts`, used by every function)

- `requireUser(ctx)` — identity from Clerk JWT (`ctx.auth.getUserIdentity()`), looked up by `clerkId`. Never trusts client-supplied ids.
- `requireAdmin(ctx)` — `requireUser` + `role === "admin"`.
- Ownership checks compare `ctx` user to `tool.ownerId` / `loan.borrowerId` / `loan.lenderId` inside the mutation, after loading the doc.

| Action | Who |
|---|---|
| List tools (public: name+category) | anyone |
| Browse tools with availability, owner first name, trusted badge | signed in |
| Create tool | signed in |
| Edit / delete tool | owner, or admin (delete only) |
| Request to borrow | signed in, not own tool, valid date range |
| Cancel request | borrower, while pending (or approved before start date) |
| Approve / decline | lender only |
| Mark returned | lender only |
| View all loans / all listings / users | admin |
| Set trustedLender | admin |
| Promote to admin | not in UI; bootstrap via `ADMIN_EMAILS` Convex env var (checked on every `users.ensure`) |

User record creation: client calls `users.ensure` once after sign-in (idempotent
upsert from JWT claims). Role defaults to `user`, becomes `admin` if the JWT
email is in `ADMIN_EMAILS`.

Validation (shared `convex/lib/validation.ts`, unit-tested): name 2–60 chars,
description ≤ 300, dates ISO `YYYY-MM-DD`, start ≤ end, start ≥ today (UTC),
range ≤ 30 days. Approve fails if another approved loan on the same tool
overlaps the range.

## Integration contract (Convex ↔ n8n)

### Signing (both directions, same scheme)

```
headers:  x-lendloop-timestamp: <unix ms>
          x-lendloop-signature: v1=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
          x-lendloop-event-id:  <idempotency key>   (POSTs only)
rawBody:  exact bytes sent ("" for GET)
verify:   |now - timestamp| ≤ 5 min, constant-time compare, else 401
```

Two secrets, two env vars, so a leak on one side doesn't forge the other:
`CONVEX_TO_N8N_SECRET` (Convex signs, n8n verifies) and
`N8N_TO_CONVEX_SECRET` (n8n signs, Convex verifies). May be set to the same
value for simplicity; README says so.

HMAC in Convex: Web Crypto (`crypto.subtle`) in the default runtime. In n8n:
Code node using Node `crypto` (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`), secret
read from `$env` (injected by docker-compose from `.env`, never in the JSON).

### Convex → n8n: loan events (outbox)

1. Any status-changing mutation inserts an `automationEvents` row and schedules
   `internal.automation.deliverEvent` immediately (same transaction, so an event
   is never lost if the mutation commits).
2. `deliverEvent` (internal action) builds the payload, signs, POSTs to
   `N8N_LOAN_EVENT_WEBHOOK_URL`. 2xx → `delivered` + log `webhook_delivered`.
   Otherwise `attempts++`, reschedule with backoff 30s, 2m, 10m, 30m, 2h; after
   5 failures → `failed` + log `webhook_failed` (shows on the loan timeline and
   the admin Automation panel).
3. Idempotency key = event `_id`; n8n and Convex both key on it.

Payload (data-minimized; **no user ids, no emails except the one recipient,
no tool description, no notes**):

```json
{
  "eventId": "<automationEvents id>",
  "type": "loan.approved",
  "occurredAt": "2026-11-07T10:00:00Z",
  "loan": { "id": "...", "toolName": "Cordless drill", "startDate": "2026-11-10", "endDate": "2026-11-12", "status": "approved" },
  "recipient": { "role": "borrower", "firstName": "Sam", "email": "sam@example.com" },
  "counterpartFirstName": "Alex",
  "appUrl": "https://lendloop.example/requests"
}
```

Recipient per type: requested → lender; approved/declined → borrower;
returned → borrower; cancelled → lender.

### n8n → Convex: HTTP actions (`convex/http.ts`), all signature-verified

| Endpoint | Purpose | Idempotency |
|---|---|---|
| `GET /n8n/overdue-loans` | approved loans with `endDate < today(UTC)` **and** not reminded today | source-side: already-reminded loans are excluded, so a rerun returns nothing new |
| `POST /n8n/notifications` `{eventId, channel, status: "sent"\|"failed", providerMessageId?, error?, sentAt}` | record that a loan-event notification was sent (or rejected by the provider) | upsert `automationLog` by key `notif:<eventId>` |
| `POST /n8n/reminders` `{reminderKey, loanId, channel, sentAt}` | record an overdue reminder, bump `lastReminderAt`/`reminderCount` **only on first insert** | key `reminder:<loanId>:<YYYY-MM-DD>` |
| `POST /n8n/automation-errors` `{executionId, workflowName, nodeName?, message, failedAt, loanId?}` | error workflow reports failed executions | key `n8nerr:<executionId>` |

All write-backs return `{ ok: true, created: boolean }` so retries are harmless.

### n8n workflows (exported JSON in `n8n/workflows/`)

1. **Loan notification** — Webhook (POST `/webhook/lendloop-loan-event`, raw body)
   → Code *Verify signature* (throws → execution fails → Convex gets 500 and
   retries; after 5 it's flagged) → Respond to Webhook `202 {accepted}` (ack
   early; n8n owns delivery from here) → Code *Build message* (subject/body by
   type) → IF `LENDLOOP_EMAIL_ENABLED == "true"` → HTTP Request to Resend
   (`Header Auth` credential "Resend API", retry 3× / 2s, *continue on error*)
   → IF Resend responded 2xx → `status: sent`; else (4xx, e.g. unverified
   recipient) → *Mock log* (Code node that logs the message; channel `mock`)
   and `status: failed` with the provider error → Code *Sign write-back* →
   HTTP Request POST `/n8n/notifications` (retry 3×). Network/5xx failures
   exhaust the retries and go to the error workflow; a 4xx is a business
   outcome, recorded on the loan, never retried.
2. **Overdue reminders** — Schedule (daily 09:00) → Code *Sign request* → HTTP
   GET `/n8n/overdue-loans` → Code *Fan out* (one item per loan, computes
   `reminderKey`, `daysOverdue`) → IF email enabled → Resend / mock → sign →
   POST `/n8n/reminders`. Empty result = clean no-op.
3. **Error handler** — Error Trigger → Code *Summarize* → sign → POST
   `/n8n/automation-errors`. Both main workflows set it as their error
   workflow (`settings.errorWorkflow`, stable id preserved by CLI import).

Retries: HTTP Request nodes `retryOnFail` 3 tries, 2s apart; execution-level
failures go to the error workflow; the Convex side independently retries
webhook delivery. Nothing fails silently: every failure path ends in an
`automationLog` row the admin can see.

Import: `npm run n8n:import` runs `n8n import:workflow` inside the container
(preserves ids) and creates the Resend credential from `.env` via a generated,
untracked credentials file.

## Frontend

Routes (App Router, `src/app`):

| Route | Auth | Content |
|---|---|---|
| `/` | public | LendLoop, tagline, read-only tool list (name + category), "Sign in to lend or borrow" (Clerk). Signed-in users see "Open your board". |
| `/browse` | user | All tools with availability + owner first name + trusted badge, category filter, "Request to borrow" (date range) dialog. |
| `/listings`, `/listings/new`, `/listings/[id]/edit` | user | My listings CRUD. |
| `/requests` | user | My outgoing requests, status, cancel, automation timeline per loan. |
| `/incoming` | user | Requests on my tools: approve / decline / mark returned, timeline. |
| `/admin` | admin | All loans, all listings (remove), users (trusted lender toggle), automation failures. Non-admins get a friendly "not for you" (backend rejects anyway). |
| `/sign-in`, `/sign-up` | public | Clerk components. |

`src/proxy.ts` (Clerk middleware for Next 16) protects everything except `/`,
`/sign-in`, `/sign-up`. Data flows through Convex React hooks (reactive, no
API routes). `ClerkProvider` wraps `ConvexProviderWithClerk`.

Visual direction: minimal, warm, "neighborhood notice board" — one accent
color, generous whitespace, cards, no dashboard chrome. Status chips use
color + text (never color alone). `next.config.ts` keeps defaults except
`cacheComponents: false` (all content is per-user and live; nothing to cache).

## Security & data-minimization decisions (also go in README)

- RBAC in Convex functions; identity only from the verified Clerk JWT.
- Public query projects `{_id, name, category}`; owner, condition, description never leave the server unauthenticated.
- n8n receives one recipient email + first names + tool name + dates. No ids of other users, no descriptions, no notes.
- HMAC-SHA256 over timestamp+raw body, 5-minute replay window, constant-time compare, separate secrets per direction.
- Secrets live in `.env.local` (Next), Convex env (dashboard/CLI), docker-compose `.env` + n8n credential store. `.env*` gitignored; `.env.example` files committed. A test asserts the exported workflow JSON contains no secret-looking strings.
- Idempotency keys on every write-back; Convex HTTP actions upsert.
- Admin bootstrap via env, not via a client-settable field.
- Resend "from" defaults to `onboarding@resend.dev`; the recipient allow-list restriction of an unverified Resend account is documented.

## Seed data

`npx convex run seed:demo` (internal mutation, safe to re-run): creates a
synthetic user "LendLoop Demo" (`clerkId: "seed:demo"`, never able to sign in)
owning ~8 tools across categories. Requests to those tools stay pending
forever, which the README states plainly. Admin = the user's own email in
`ADMIN_EMAILS` on both the local and prod Convex deployments.

## Deployment

- **Next.js** → Vercel, team `abeselomgs-projects`, env: `NEXT_PUBLIC_CONVEX_URL`, Clerk keys.
- **Convex** → prod deployment via `npx convex deploy` (user runs `npx convex login` once); env vars set with `npx convex env set`.
- **n8n** → Railway: `n8n/railway/` with a README of steps (service from image `docker.n8n.io/n8nio/n8n:2.46.6`, Postgres plugin, env vars incl. `N8N_ENCRYPTION_KEY`, `WEBHOOK_URL`, the two secrets, `LENDLOOP_CONVEX_SITE_URL`), import workflows, create the Resend credential, activate.
- **Clerk** → the dev instance is fine for the demo; production instance is in the production note.

## Verification plan

- `vitest` + `convex-test`: RBAC (non-lender cannot approve; non-owner cannot edit; non-admin cannot remove others' listing; public query shape), validation, outbox creation on status change, write-back idempotency (POST twice → one log row, one reminderCount bump), signature sign/verify + replay rejection.
- Local end-to-end: Convex local + n8n Docker, real signed webhooks both ways, mock channel; then Resend with the user's key.
- Browser QA pass by a subagent against the running app with a Clerk test user, before the final commit.

## Production note (goes in README)

Separate Convex prod deployment and Clerk prod instance; n8n on Railway with
Postgres + persisted encryption key, basic auth/SSO in front; Resend verified
domain; rotate secrets, shorter replay window; alerting on `workflow_error`
and `webhook_failed` (e.g. Slack from the error workflow); rate-limit public
query; soft-delete tools for audit; move outbox to a cron sweeper for stuck
events; structured logging; Convex scheduled function to purge old logs.

## Left to the builder

Exact copy, component structure, Tailwind tokens, empty states, the email
templates' wording, test fixture names, and the order of implementation.
