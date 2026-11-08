import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { makeT, signIn } from "./test.setup";
import { computeSignature, signedHeaders, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "./lib/signature";

const SECRET = "n8n-secret-value";
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const t = makeT();
  const alice = await signIn(t, "alice"); // borrower
  const bob = await signIn(t, "bob"); // lender
  const toolId = await bob.mutation(api.tools.create, {
    name: "Cordless Drill",
    category: "power_tools",
    condition: "good",
    description: "d",
  });
  const loanId = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(3) });
  const [event] = await t.run((ctx) => ctx.db.query("automationEvents").collect());
  const users = await t.run((ctx) => ctx.db.query("users").collect());
  const borrowerId = users.find((u) => u.email === "alice@example.com")!._id;
  const lenderId = users.find((u) => u.email === "bob@example.com")!._id;
  const mkLoan = (over: Record<string, unknown>) =>
    t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        toolName: "Cordless Drill",
        borrowerId,
        lenderId,
        startDate: addDays(-10),
        endDate: addDays(-2),
        status: "approved",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reminderCount: 0,
        ...over,
      } as unknown as Omit<Doc<"loans">, "_id" | "_creationTime">),
    );
  return { t, loanId, event, mkLoan };
}

const post = async (t: ReturnType<typeof makeT>, path: string, body: string) =>
  t.fetch(path, { method: "POST", headers: await signedHeaders(SECRET, body), body });
const postJson = (t: ReturnType<typeof makeT>, path: string, obj: unknown) => post(t, path, JSON.stringify(obj));
const logs = (t: ReturnType<typeof makeT>) => t.run((ctx) => ctx.db.query("automationLog").collect());

describe("n8n http endpoints", () => {
  beforeEach(() => {
    vi.stubEnv("N8N_TO_CONVEX_SECRET", SECRET);
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  });

  it("returns 503 when the secret is not configured", async () => {
    vi.stubEnv("N8N_TO_CONVEX_SECRET", "");
    const { t } = await setup();
    const res = await t.fetch("/n8n/overdue-loans", { method: "GET" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "N8N_TO_CONVEX_SECRET not configured" });
  });

  it("rejects unsigned and stale requests with 401", async () => {
    const { t } = await setup();
    const unsigned = await t.fetch("/n8n/overdue-loans", { method: "GET" });
    expect(unsigned.status).toBe(401);
    expect(await unsigned.json()).toEqual({ error: "missing_headers" });

    const ts = Date.now() - 6 * 60 * 1000;
    const stale = await t.fetch("/n8n/overdue-loans", {
      method: "GET",
      headers: {
        [TIMESTAMP_HEADER]: String(ts),
        [SIGNATURE_HEADER]: "v1=" + (await computeSignature(SECRET, ts, "")),
      },
    });
    expect(stale.status).toBe(401);
    expect(await stale.json()).toEqual({ error: "stale" });
  });

  it("GET overdue-loans returns only approved loans with endDate < today not reminded today", async () => {
    const { t, mkLoan } = await setup();
    const overdue = await mkLoan({ endDate: addDays(-2) });
    await mkLoan({ endDate: addDays(0) });
    await mkLoan({ endDate: addDays(-3), lastReminderAt: Date.now() });
    await mkLoan({ endDate: addDays(-3), status: "returned" });
    const res = await t.fetch("/n8n/overdue-loans", { method: "GET", headers: await signedHeaders(SECRET, "") });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json.today).toBe(addDays(0));
    expect(json.loans).toHaveLength(1);
    expect(json.loans[0]).toMatchObject({
      loanId: overdue,
      toolName: "Cordless Drill",
      daysOverdue: 2,
      borrower: { firstName: "Alice", email: "alice@example.com" },
      lenderFirstName: "Bob",
    });
  });

  it("POST notifications is idempotent: second call created=false, one log row", async () => {
    const { t, event, loanId } = await setup();
    const body = { eventId: event._id, channel: "email", status: "sent", providerMessageId: "m1", sentAt: "2026-01-01T00:00:00Z" };
    const r1 = await postJson(t, "/n8n/notifications", body);
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ ok: true, created: true });
    const r2 = await postJson(t, "/n8n/notifications", body);
    expect(await r2.json()).toEqual({ ok: true, created: false });
    const rows = (await logs(t)).filter((l) => l.kind === "notification_sent");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ loanId, source: "n8n", message: "Request email sent", idempotencyKey: `notif:${event._id}` });
  });

  it("POST notifications labels the message by event type", async () => {
    const { t, event } = await setup();
    const other = await t.run(async (ctx) => {
      return ctx.db.insert("automationEvents", { loanId: event.loanId, type: "loan.approved", recipientUserId: event.recipientUserId, status: "pending", attempts: 0, nextAttemptAt: 0, createdAt: Date.now() });
    });
    await postJson(t, "/n8n/notifications", { eventId: event._id, channel: "email", status: "sent", sentAt: "2026-01-01T00:00:00Z" });
    await postJson(t, "/n8n/notifications", { eventId: other, channel: "mock", status: "sent", sentAt: "2026-01-01T00:00:00Z" });
    const msgs = (await logs(t)).filter((l) => l.kind === "notification_sent").map((l) => l.message).sort();
    expect(msgs).toEqual(["Approval mock notification sent", "Request email sent"]);
  });

  it("POST notifications sanitizes provider errors (emails stripped, capped at 200 chars)", async () => {
    const { t, event } = await setup();
    const error = "Resend: account owner@example.com is not verified " + "x".repeat(300);
    const res = await postJson(t, "/n8n/notifications", { eventId: event._id, channel: "email", status: "failed", error, sentAt: "2026-01-01T00:00:00Z" });
    expect(res.status).toBe(200);
    const row = (await logs(t)).find((l) => l.kind === "notification_failed")!;
    expect(row.message).not.toContain("owner@example.com");
    expect(row.message).toContain("[email]");
    expect(row.message.length).toBeLessThanOrEqual("Request email failed: ".length + 200);
  });

  it("POST reminders bumps reminderCount once across two identical calls", async () => {
    const { t, mkLoan } = await setup();
    const loanId = await mkLoan({});
    const body = { reminderKey: `${loanId}:2026-01-01`, loanId, channel: "email", status: "sent", sentAt: "2026-01-01T00:00:00Z" };
    expect(await (await postJson(t, "/n8n/reminders", body)).json()).toEqual({ ok: true, created: true });
    expect(await (await postJson(t, "/n8n/reminders", body)).json()).toEqual({ ok: true, created: false });
    const loan = await t.run((ctx) => ctx.db.get(loanId));
    expect(loan!.reminderCount).toBe(1);
    expect(loan!.lastReminderAt).toBeTypeOf("number");
    expect((await logs(t)).filter((l) => l.kind === "reminder_sent")).toHaveLength(1);
  });

  it("POST automation-errors stores workflow_error visible via automation.listFailures", async () => {
    const { t } = await setup();
    const res = await postJson(t, "/n8n/automation-errors", {
      executionId: "ex1",
      workflowName: "Loan events",
      nodeName: "Send Email",
      message: "boom",
      failedAt: "2026-01-01T00:00:00Z",
      loanId: "not-a-real-id",
    });
    expect(await res.json()).toEqual({ ok: true, created: true });
    const admin = await signIn(t, "admin");
    const { errors } = await admin.query(api.automation.listFailures, {});
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Loan events: boom");
  });

  it("malformed JSON and unknown ids return 400, not 500", async () => {
    const { t } = await setup();
    const bad = await post(t, "/n8n/notifications", "{not json");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Invalid JSON" });

    const missing = await postJson(t, "/n8n/notifications", { channel: "email" });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toContain("eventId");

    const unknownLoan = await postJson(t, "/n8n/reminders", {
      reminderKey: "k", loanId: "nope", channel: "email", status: "sent", sentAt: "x",
    });
    expect(unknownLoan.status).toBe(400);
    expect(await unknownLoan.json()).toEqual({ error: "Unknown loanId" });

    const unknownEvent = await postJson(t, "/n8n/notifications", {
      eventId: "nope", channel: "email", status: "sent", sentAt: "x",
    });
    expect(unknownEvent.status).toBe(400);
    expect(await unknownEvent.json()).toEqual({ error: "Unknown eventId" });
  });
});
