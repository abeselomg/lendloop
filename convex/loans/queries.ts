import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin, requireUser } from "../lib/access";
import { todayUtc } from "../lib/validation";
import { toLoanView } from "../lib/views";

const newestFirst = <T extends { createdAt: number; _creationTime: number }>(a: T, b: T) =>
  b.createdAt - a.createdAt || b._creationTime - a._creationTime;

/** Dates a tool is already lent out (approved, not yet ended), for the request calendar. Dates only: no borrower. */
export const bookedRanges = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    await requireUser(ctx);
    const today = todayUtc();
    const approved = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
      .collect();
    return approved
      .filter((l) => l.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((l) => ({ startDate: l.startDate, endDate: l.endDate }));
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const loans = await ctx.db.query("loans").withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id)).collect();
    return await Promise.all(loans.sort(newestFirst).map((l) => toLoanView(ctx, l, viewer)));
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const loans = await ctx.db.query("loans").withIndex("by_lender", (q) => q.eq("lenderId", viewer._id)).collect();
    loans.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || newestFirst(a, b));
    return await Promise.all(loans.map((l) => toLoanView(ctx, l, viewer)));
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").collect();
    return await Promise.all(loans.sort(newestFirst).map((l) => toLoanView(ctx, l, viewer)));
  },
});
