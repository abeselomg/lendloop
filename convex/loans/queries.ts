import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { loanStatusValidator } from "../schema";
import { requireAdmin, requireUser } from "../lib/access";
import { todayUtc } from "../lib/validation";
import { toLoanView } from "../lib/views";

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

// Indexes order by _creationTime, which equals request order (createdAt is set at insert).
export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const viewer = await requireUser(ctx);
    const result = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((l) => toLoanView(ctx, l, viewer))) };
  },
});

export const incoming = query({
  args: { paginationOpts: paginationOptsValidator, group: v.union(v.literal("pending"), v.literal("active"), v.literal("history")) },
  handler: async (ctx, { paginationOpts, group }) => {
    const viewer = await requireUser(ctx);
    const base = ctx.db.query("loans");
    const result =
      group === "history"
        ? await base
            .withIndex("by_lender", (q) => q.eq("lenderId", viewer._id))
            .order("desc")
            .filter((q) => q.and(q.neq(q.field("status"), "pending"), q.neq(q.field("status"), "approved")))
            .paginate(paginationOpts)
        : await base
            .withIndex("by_lender_status", (q) =>
              q.eq("lenderId", viewer._id).eq("status", group === "pending" ? "pending" : "approved"),
            )
            .order("desc")
            .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((l) => toLoanView(ctx, l, viewer))) };
  },
});

export const all = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(loanStatusValidator) },
  handler: async (ctx, { paginationOpts, status }) => {
    const viewer = await requireAdmin(ctx);
    const q = status
      ? ctx.db.query("loans").withIndex("by_status", (x) => x.eq("status", status))
      : ctx.db.query("loans");
    const result = await q.order("desc").paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((l) => toLoanView(ctx, l, viewer))) };
  },
});
