import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { makeT, signIn } from "./test.setup";
import type { Id } from "./_generated/dataModel";
import { verifySignature } from "./lib/signature";
import { BACKOFF_MS, MAX_ATTEMPTS } from "./automation";

const SECRET = "test-secret-value";
const URL_ = "https://n8n.example.com/webhook/loan-event";
const DESCRIPTION = "PRIVATE-DESCRIPTION-TEXT";
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const t = makeT();
  const alice = await signIn(t, "alice"); // borrower
  const bob = await signIn(t, "bob"); // lender
  const toolId = await bob.mutation(api.tools.create, {
    name: "Cordless Drill",
    category: "power_tools",
    condition: "good",
    description: DESCRIPTION,
  });
  const loanId = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(3) });
  const [event] = await t.run((ctx) => ctx.db.query("automationEvents").collect());
  return { t, alice, bob, loanId, event };
}
// runAfter(0) fires on a macrotask; let it start, then wait for it to finish.
async function flush(t: ReturnType<typeof makeT>) {
  await new Promise((r) => setTimeout(r, 20));
  await t.finishInProgressScheduledFunctions();
}
const logs = (t: ReturnType<typeof makeT>) => t.run((ctx) => ctx.db.query("automationLog").collect());
const getEvent = (t: ReturnType<typeof makeT>, id: Id<"automationEvents">) => t.run((ctx) => ctx.db.get(id));

describe("automation outbox", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    vi.stubEnv("N8N_LOAN_EVENT_WEBHOOK_URL", URL_);
    vi.stubEnv("CONVEX_TO_N8N_SECRET", SECRET);
    fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("delivers signed payload and marks delivered + log", async () => {
    const { t, event, loanId } = await setup();
    await flush(t);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-lendloop-timestamp"]).toBeTruthy();
    expect(headers["x-lendloop-signature"]).toMatch(/^v1=/);
    expect(headers["x-lendloop-event-id"]).toBe(event._id);
    const body = init.body as string;
    expect(await verifySignature(SECRET, new Headers(headers), body)).toEqual({ ok: true });
    const parsed = JSON.parse(body);
    expect(Object.keys(parsed).sort()).toEqual(
      ["appUrl", "counterpartFirstName", "eventId", "loan", "occurredAt", "recipient", "type"].sort(),
    );
    expect(parsed.loan.id).toBe(loanId);
    expect(body).not.toContain("alice@example.com");
    expect(body).not.toContain(DESCRIPTION);
    const ids = await t.run(async (ctx) => (await ctx.db.query("users").collect()).map((u) => u._id as string));
    for (const id of ids) expect(body).not.toContain(id);

    const after = await getEvent(t, event._id);
    expect(after?.status).toBe("delivered");
    expect(after?.deliveredAt).toBeTypeOf("number");
    const l = await logs(t);
    expect(l.filter((x) => x.kind === "webhook_delivered")).toHaveLength(1);
    expect(l[0].idempotencyKey).toBe(`delivered:${event._id}`);
  });

  it("payload for loan.requested targets lender email", async () => {
    const { t } = await setup();
    await flush(t);
    const parsed = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(parsed.type).toBe("loan.requested");
    expect(parsed.recipient).toEqual({ role: "lender", firstName: "Bob", email: "bob@example.com" });
    expect(parsed.counterpartFirstName).toBe("Alice");
    expect(parsed.appUrl).toBe("http://localhost:3000/incoming");
    expect(parsed.loan.toolName).toBe("Cordless Drill");
    expect(parsed.loan.status).toBe("pending");
  });

  it("non-2xx schedules retry with first backoff and increments attempts", async () => {
    fetchMock.mockImplementation(async () => new Response("no", { status: 500 }));
    const { t, event } = await setup();
    const before = Date.now();
    await flush(t);
    const after = await getEvent(t, event._id);
    expect(after?.attempts).toBe(1);
    expect(after?.status).toBe("pending");
    expect(after?.lastError).toBe("HTTP 500");
    expect(after!.nextAttemptAt).toBeGreaterThanOrEqual(before + BACKOFF_MS[0]);
    expect(after!.nextAttemptAt).toBeLessThan(before + BACKOFF_MS[0] + 5_000);
  });

  it("fails permanently after MAX_ATTEMPTS with webhook_failed log", async () => {
    const { t, event } = await setup(); // not flushed: event stays pending
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = await t.mutation(internal.automation.markAttemptFailed, { eventId: event._id, error: "boom" });
      expect(r.willRetry).toBe(i < MAX_ATTEMPTS - 1);
    }
    const after = await getEvent(t, event._id);
    expect(after?.status).toBe("failed");
    expect(after?.attempts).toBe(MAX_ATTEMPTS);
    expect(after?.lastError).toBe("boom");
    const failed = (await logs(t)).filter((x) => x.kind === "webhook_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].message).toBe("Could not reach n8n after 5 attempts: boom");
    expect(failed[0].idempotencyKey).toBe(`failed:${event._id}`);
  });

  it("orphaned event (loan deleted) fails terminally without calling fetch", async () => {
    const { t, event, loanId } = await setup();
    await t.run((ctx) => ctx.db.delete(loanId));
    await flush(t);
    expect(fetchMock).not.toHaveBeenCalled();
    const after = await getEvent(t, event._id);
    expect(after?.status).toBe("failed");
    expect(after?.lastError).toBe("Loan or recipient no longer exists");
    expect((await logs(t)).filter((x) => x.kind === "webhook_failed")).toHaveLength(1);
  });

  it("re-running deliverEvent on a delivered event is a no-op", async () => {
    const { t, event } = await setup();
    await flush(t);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await t.action(internal.automation.deliverEvent, { eventId: event._id });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await logs(t)).filter((x) => x.kind === "webhook_delivered")).toHaveLength(1);
    expect((await getEvent(t, event._id))?.status).toBe("delivered");
  });

  it("missing webhook URL marks failed immediately with readable error", async () => {
    vi.stubEnv("N8N_LOAN_EVENT_WEBHOOK_URL", "");
    const { t, event } = await setup();
    await flush(t);
    expect(fetchMock).not.toHaveBeenCalled();
    const after = await getEvent(t, event._id);
    expect(after?.status).toBe("failed");
    expect(after?.attempts).toBe(MAX_ATTEMPTS);
    expect(after?.lastError).toBe("Missing environment variable N8N_LOAN_EVENT_WEBHOOK_URL");
    const failed = (await logs(t)).filter((x) => x.kind === "webhook_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].message).toContain("Missing environment variable N8N_LOAN_EVENT_WEBHOOK_URL");
  });

  it("listFailures is admin only and lists failed events", async () => {
    vi.stubEnv("CONVEX_TO_N8N_SECRET", "");
    const { t, alice } = await setup();
    await flush(t);
    await t.run((ctx) =>
      ctx.db.insert("automationLog", {
        kind: "workflow_error",
        source: "n8n",
        message: "node exploded",
        idempotencyKey: "wf:1",
        createdAt: Date.now(),
      }),
    );
    await expect(alice.query(api.automation.listFailures, {})).rejects.toThrow("Admin only");
    const admin = await signIn(t, "admin");
    const res = await admin.query(api.automation.listFailures, {});
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({
      type: "loan.requested",
      toolName: "Cordless Drill",
      attempts: MAX_ATTEMPTS,
      lastError: "Missing environment variable CONVEX_TO_N8N_SECRET",
    });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toBe("node exploded");
  });
});
