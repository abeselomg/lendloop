import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { firstNameOf } from "./lib/access";
import { daysBetween, todayUtc } from "./lib/validation";

const statusValidator = v.union(v.literal("sent"), v.literal("failed"));

export const overdueLoans = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const approved = await ctx.db.query("loans").withIndex("by_status", (q) => q.eq("status", "approved")).collect();
    const due = approved.filter(
      (l) => l.endDate < today && (l.lastReminderAt === undefined || todayUtc(l.lastReminderAt) !== today),
    );
    const out = [];
    for (const l of due) {
      const borrower = await ctx.db.get(l.borrowerId);
      const lender = await ctx.db.get(l.lenderId);
      if (!borrower || !lender) continue;
      out.push({
        loanId: l._id as string,
        toolName: l.toolName,
        startDate: l.startDate,
        endDate: l.endDate,
        daysOverdue: daysBetween(l.endDate, today),
        borrower: { firstName: firstNameOf(borrower), email: borrower.email },
        lenderFirstName: firstNameOf(lender),
      });
    }
    return out;
  },
});

async function keyExists(ctx: MutationCtx, key: string): Promise<boolean> {
  const hit = await ctx.db.query("automationLog").withIndex("by_key", (q) => q.eq("idempotencyKey", key)).first();
  return hit !== null;
}

function sanitizeError(e: string | undefined): string | undefined {
  if (e === undefined) return undefined;
  return e.replace(/[^\s@]+@[^\s@]+/g, "[email]").slice(0, 200);
}

function compact(o: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, x] of Object.entries(o)) if (x !== undefined) out[k] = x;
  return out;
}

export const recordNotification = internalMutation({
  args: {
    eventId: v.string(),
    channel: v.string(),
    status: statusValidator,
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.string(),
  },
  handler: async (ctx, raw): Promise<{ created: boolean }> => {
    const a = { ...raw, error: sanitizeError(raw.error) };
    const id = ctx.db.normalizeId("automationEvents", a.eventId);
    const event = id ? await ctx.db.get(id) : null;
    if (!event) throw new ConvexError("Unknown eventId");
    const key = `notif:${a.eventId}`;
    if (await keyExists(ctx, key)) return { created: false };
    await ctx.db.insert("automationLog", {
      loanId: event.loanId,
      kind: a.status === "sent" ? "notification_sent" : "notification_failed",
      source: "n8n",
      message: `${a.channel === "email" ? "Email" : "Mock notification"} ${a.status === "sent" ? "sent" : "failed"}${a.error ? ": " + a.error : ""}`,
      idempotencyKey: key,
      createdAt: Date.now(),
      meta: compact({ channel: a.channel, providerMessageId: a.providerMessageId, sentAt: a.sentAt }),
    });
    return { created: true };
  },
});

export const recordReminder = internalMutation({
  args: {
    reminderKey: v.string(),
    loanId: v.string(),
    channel: v.string(),
    status: statusValidator,
    error: v.optional(v.string()),
    sentAt: v.string(),
  },
  handler: async (ctx, raw): Promise<{ created: boolean }> => {
    const a = { ...raw, error: sanitizeError(raw.error) };
    const id = ctx.db.normalizeId("loans", a.loanId);
    const loan = id ? await ctx.db.get(id) : null;
    if (!id || !loan) throw new ConvexError("Unknown loanId");
    const key = `reminder:${a.reminderKey}`;
    if (await keyExists(ctx, key)) return { created: false };
    const sent = a.status === "sent";
    await ctx.db.insert("automationLog", {
      loanId: id,
      kind: sent ? "reminder_sent" : "notification_failed",
      source: "n8n",
      message: sent ? "Reminder sent to borrower" : `Reminder failed: ${a.error ?? "unknown error"}`,
      idempotencyKey: key,
      createdAt: Date.now(),
      meta: compact({ channel: a.channel, sentAt: a.sentAt }),
    });
    if (sent) {
      await ctx.db.patch(id, { lastReminderAt: Date.now(), reminderCount: loan.reminderCount + 1 });
    }
    return { created: true };
  },
});

export const recordWorkflowError = internalMutation({
  args: {
    executionId: v.string(),
    workflowName: v.string(),
    nodeName: v.optional(v.string()),
    message: v.string(),
    failedAt: v.string(),
    loanId: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<{ created: boolean }> => {
    const key = `n8nerr:${a.executionId}`;
    if (await keyExists(ctx, key)) return { created: false };
    const loanId: Id<"loans"> | undefined = a.loanId ? (ctx.db.normalizeId("loans", a.loanId) ?? undefined) : undefined;
    await ctx.db.insert("automationLog", {
      loanId,
      kind: "workflow_error",
      source: "n8n",
      message: `${a.workflowName}: ${a.message}`,
      idempotencyKey: key,
      createdAt: Date.now(),
      meta: compact({
        workflowName: a.workflowName,
        nodeName: a.nodeName,
        executionId: a.executionId,
        failedAt: a.failedAt,
      }),
    });
    return { created: true };
  },
});
