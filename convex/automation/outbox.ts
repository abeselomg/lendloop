import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { EventType } from "../lib/validation";

export const BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000];
export const MAX_ATTEMPTS = 5;

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
  await ctx.scheduler.runAfter(0, internal.automation.actions.deliverEvent, { eventId });
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
