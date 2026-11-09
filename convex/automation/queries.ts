import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/access";
import type { ActivityEntry } from "../lib/views";

export const failedEvents = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("automationEvents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (e) => {
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
    return { ...result, page };
  },
});

export const workflowErrors = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("automationLog")
      .withIndex("by_kind", (q) => q.eq("kind", "workflow_error"))
      .order("desc")
      .paginate(paginationOpts);
    const page: ActivityEntry[] = result.page.map((l) => ({
      _id: l._id,
      kind: l.kind,
      source: l.source,
      message: l.message,
      createdAt: l.createdAt,
      meta: l.meta,
    }));
    return { ...result, page };
  },
});
