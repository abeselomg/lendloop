import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { firstNameOf, requireAdmin } from "./lib/access";
import { signedHeaders } from "./lib/signature";
import type { ActivityEntry } from "./lib/views";
import type { EventType, LoanStatus } from "./lib/validation";

export const BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];
export const MAX_ATTEMPTS = 5;

export type LoanEventPayload = {
  eventId: string;
  type: EventType;
  occurredAt: string;
  loan: { id: string; toolName: string; startDate: string; endDate: string; status: LoanStatus };
  recipient: { role: "borrower" | "lender"; firstName: string; email: string };
  counterpartFirstName: string;
  appUrl: string;
};

export async function enqueueLoanEvent(
  ctx: MutationCtx,
  args: { loanId: Id<"loans">; type: EventType; recipientUserId: Id<"users"> },
): Promise<Id<"automationEvents">> {
  const now = Date.now();
  const eventId = await ctx.db.insert("automationEvents", {
    loanId: args.loanId,
    type: args.type,
    recipientUserId: args.recipientUserId,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.automation.deliverEvent, { eventId });
  return eventId;
}

export async function declinePendingLoansForTool(ctx: MutationCtx, toolId: Id<"tools">): Promise<number> {
  const pending = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "pending"))
    .collect();
  for (const loan of pending) {
    await ctx.db.patch(loan._id, { status: "declined", updatedAt: Date.now() });
    await enqueueLoanEvent(ctx, { loanId: loan._id, type: "loan.declined", recipientUserId: loan.borrowerId });
  }
  return pending.length;
}

export type EventPayloadResult =
  | { kind: "skip" }
  | { kind: "orphaned" }
  | { kind: "ok"; payload: LoanEventPayload };

export const getEventPayload = internalQuery({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }): Promise<EventPayloadResult> => {
    const event = await ctx.db.get(eventId);
    if (!event || event.status !== "pending") return { kind: "skip" };
    const loan = await ctx.db.get(event.loanId);
    const recipient = await ctx.db.get(event.recipientUserId);
    if (!loan || !recipient) return { kind: "orphaned" };
    const role = event.type === "loan.requested" || event.type === "loan.cancelled" ? "lender" : "borrower";
    const counterpart = await ctx.db.get(role === "lender" ? loan.borrowerId : loan.lenderId);
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const payload: LoanEventPayload = {
      eventId: event._id,
      type: event.type,
      occurredAt: new Date(event.createdAt).toISOString(),
      loan: {
        id: loan._id,
        toolName: loan.toolName,
        startDate: loan.startDate,
        endDate: loan.endDate,
        status: loan.status,
      },
      recipient: { role, firstName: firstNameOf(recipient), email: recipient.email },
      counterpartFirstName: counterpart ? firstNameOf(counterpart) : "Someone",
      appUrl: base + (role === "lender" ? "/incoming" : "/requests"),
    };
    return { kind: "ok", payload };
  },
});

export const markDelivered = internalMutation({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.status !== "pending") return null;
    const now = Date.now();
    await ctx.db.patch(eventId, { status: "delivered", deliveredAt: now });
    const key = `delivered:${eventId}`;
    const existing = await ctx.db.query("automationLog").withIndex("by_key", (q) => q.eq("idempotencyKey", key)).first();
    if (!existing) {
      await ctx.db.insert("automationLog", {
        loanId: event.loanId,
        kind: "webhook_delivered",
        source: "convex",
        message: "Notification handed to n8n",
        idempotencyKey: key,
        createdAt: now,
      });
    }
    return null;
  },
});

export const markAttemptFailed = internalMutation({
  args: { eventId: v.id("automationEvents"), error: v.string(), terminal: v.optional(v.boolean()) },
  handler: async (ctx, { eventId, error, terminal }): Promise<{ willRetry: boolean }> => {
    const event = await ctx.db.get(eventId);
    if (!event || event.status !== "pending") return { willRetry: false };
    const now = Date.now();
    const attempts = terminal ? MAX_ATTEMPTS : event.attempts + 1;
    if (!terminal && attempts < MAX_ATTEMPTS) {
      const delay = BACKOFF_MS[attempts - 1];
      await ctx.db.patch(eventId, { attempts, lastError: error, nextAttemptAt: now + delay });
      await ctx.scheduler.runAfter(delay, internal.automation.deliverEvent, { eventId });
      return { willRetry: true };
    }
    await ctx.db.patch(eventId, { status: "failed", attempts, lastError: error });
    const key = `failed:${eventId}`;
    const existing = await ctx.db.query("automationLog").withIndex("by_key", (q) => q.eq("idempotencyKey", key)).first();
    if (!existing) {
      await ctx.db.insert("automationLog", {
        loanId: event.loanId,
        kind: "webhook_failed",
        source: "convex",
        message: terminal
          ? `Could not deliver to n8n: ${error}`
          : `Could not reach n8n after ${attempts} attempts: ${error}`,
        idempotencyKey: key,
        createdAt: now,
      });
    }
    return { willRetry: false };
  },
});

export const deliverEvent = internalAction({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }): Promise<null> => {
    const result = await ctx.runQuery(internal.automation.getEventPayload, { eventId });
    if (result.kind === "skip") return null;
    if (result.kind === "orphaned") {
      await ctx.runMutation(internal.automation.markAttemptFailed, {
        eventId,
        error: "Loan or recipient no longer exists",
        terminal: true,
      });
      return null;
    }
    const url = process.env.N8N_LOAN_EVENT_WEBHOOK_URL;
    const secret = process.env.CONVEX_TO_N8N_SECRET;
    const missing = !url ? "N8N_LOAN_EVENT_WEBHOOK_URL" : !secret ? "CONVEX_TO_N8N_SECRET" : null;
    if (missing || !url || !secret) {
      await ctx.runMutation(internal.automation.markAttemptFailed, {
        eventId,
        error: `Missing environment variable ${missing}`,
        terminal: true,
      });
      return null;
    }
    const body = JSON.stringify(result.payload);
    const headers = await signedHeaders(secret, body, { eventId });
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body });
    } catch (error) {
      await ctx.runMutation(internal.automation.markAttemptFailed, {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
    if (res.ok) {
      await ctx.runMutation(internal.automation.markDelivered, { eventId });
    } else {
      await ctx.runMutation(internal.automation.markAttemptFailed, { eventId, error: `HTTP ${res.status}` });
    }
    return null;
  },
});

export const listFailures = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const failed = await ctx.db.query("automationEvents").withIndex("by_status", (q) => q.eq("status", "failed")).collect();
    failed.sort((a, b) => b.createdAt - a.createdAt);
    const events = await Promise.all(
      failed.map(async (e) => {
        const loan = await ctx.db.get(e.loanId);
        return {
          _id: e._id,
          type: e.type,
          loanId: e.loanId,
          toolName: loan?.toolName ?? "(removed)",
          attempts: e.attempts,
          lastError: e.lastError,
          createdAt: e.createdAt,
        };
      }),
    );
    const logs = await ctx.db.query("automationLog").withIndex("by_kind", (q) => q.eq("kind", "workflow_error")).order("desc").take(20);
    const errors: ActivityEntry[] = logs.map((l) => ({
      _id: l._id,
      kind: l.kind,
      source: l.source,
      message: l.message,
      createdAt: l.createdAt,
      meta: l.meta,
    }));
    return { events, errors };
  },
});
