import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { firstNameOf } from "../lib/access";
import { EVENT_LABELS, type EventType, type LoanStatus } from "../lib/validation";
import { BACKOFF_MS, MAX_ATTEMPTS } from "./outbox";

export type LoanEventPayload = {
  eventId: string;
  type: EventType;
  occurredAt: string;
  loan: { id: string; toolName: string; startDate: string; endDate: string; status: LoanStatus };
  recipient: { role: "borrower" | "lender"; firstName: string; email: string };
  counterpartFirstName: string;
  appUrl: string;
};

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
        message: `${EVENT_LABELS[event.type]} notification handed to n8n`,
        idempotencyKey: key,
        createdAt: now,
        meta: { eventType: event.type },
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
      await ctx.scheduler.runAfter(delay, internal.automation.actions.deliverEvent, { eventId });
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
        meta: { eventType: event.type },
      });
    }
    return { willRetry: false };
  },
});
