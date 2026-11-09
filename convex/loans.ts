import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/access";
import { rangesOverlap, todayUtc, validateDateRange } from "./lib/validation";
import { toLoanView } from "./lib/views";
import { enqueueLoanEvent } from "./automation";

const MAX_NOTE = 300;
const newestFirst = <T extends { createdAt: number; _creationTime: number }>(a: T, b: T) =>
  b.createdAt - a.createdAt || b._creationTime - a._creationTime;

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { toolId, startDate, endDate, note }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found");
    if (tool.ownerId === user._id) throw new ConvexError("You can't borrow your own tool");
    const err = validateDateRange(startDate, endDate, todayUtc());
    if (err) throw new ConvexError(err);
    const cleanNote = note?.trim();
    if (cleanNote && cleanNote.length > MAX_NOTE) throw new ConvexError("Note is too long");
    const approved = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
      .collect();
    if (approved.some((o) => rangesOverlap(startDate, endDate, o.startDate, o.endDate))) {
      throw new ConvexError("Those dates are already booked");
    }
    const now = Date.now();
    const loanId = await ctx.db.insert("loans", {
      toolId,
      toolName: tool.name,
      borrowerId: user._id,
      lenderId: tool.ownerId,
      startDate,
      endDate,
      note: cleanNote || undefined,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      reminderCount: 0,
    });
    await enqueueLoanEvent(ctx, { loanId, type: "loan.requested", recipientUserId: tool.ownerId });
    return loanId;
  },
});

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

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.lenderId !== user._id) throw new ConvexError("Only the lender can do that");
    if (loan.status !== "pending") throw new ConvexError("Request is not pending");
    if (loan.endDate < todayUtc()) throw new ConvexError("Those dates have passed");
    const approved = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", loan.toolId).eq("status", "approved"))
      .collect();
    if (approved.some((o) => o._id !== loan._id && rangesOverlap(loan.startDate, loan.endDate, o.startDate, o.endDate))) {
      throw new ConvexError("Tool is already lent out for those dates");
    }
    await ctx.db.patch(loanId, { status: "approved", updatedAt: Date.now() });
    await enqueueLoanEvent(ctx, { loanId, type: "loan.approved", recipientUserId: loan.borrowerId });
    return null;
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.lenderId !== user._id) throw new ConvexError("Only the lender can do that");
    if (loan.status !== "pending") throw new ConvexError("Request is not pending");
    await ctx.db.patch(loanId, { status: "declined", updatedAt: Date.now() });
    await enqueueLoanEvent(ctx, { loanId, type: "loan.declined", recipientUserId: loan.borrowerId });
    return null;
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.lenderId !== user._id) throw new ConvexError("Only the lender can do that");
    if (loan.status !== "approved") throw new ConvexError("Only approved loans can be marked returned");
    const now = Date.now();
    await ctx.db.patch(loanId, { status: "returned", returnedAt: now, updatedAt: now });
    await enqueueLoanEvent(ctx, { loanId, type: "loan.returned", recipientUserId: loan.borrowerId });
    return null;
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.borrowerId !== user._id) throw new ConvexError("Only the borrower can do that");
    const ok = loan.status === "pending" || (loan.status === "approved" && loan.startDate > todayUtc());
    if (!ok) throw new ConvexError("This loan can no longer be cancelled");
    await ctx.db.patch(loanId, { status: "cancelled", updatedAt: Date.now() });
    await enqueueLoanEvent(ctx, { loanId, type: "loan.cancelled", recipientUserId: loan.lenderId });
    return null;
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
