import { query } from "../_generated/server";
import { requireAdmin } from "../lib/access";
import type { ActivityEntry } from "../lib/views";

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
