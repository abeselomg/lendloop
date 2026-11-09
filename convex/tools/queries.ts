import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin, requireUser } from "../lib/access";
import { isToolOnLoan, toToolView } from "../lib/views";

export const listPublic = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("tools").withIndex("by_name").paginate(paginationOpts);
    const page: { _id: (typeof result.page)[number]["_id"]; name: string; category: string }[] = [];
    for (const t of result.page) {
      if (await isToolOnLoan(ctx, t._id)) continue;
      page.push({ _id: t._id, name: t.name, category: t.category });
    }
    return { ...result, page };
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, category: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, { paginationOpts, category, search }) => {
    const viewer = await requireUser(ctx);
    const term = search?.trim();
    const q = term
      ? ctx.db.query("tools").withSearchIndex("search_name", (s) => {
          const base = s.search("name", term);
          return category ? base.eq("category", category) : base;
        })
      : category
        ? ctx.db.query("tools").withIndex("by_category_name", (x) => x.eq("category", category))
        : ctx.db.query("tools").withIndex("by_name");
    const result = await q.paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((t) => toToolView(ctx, t, viewer))) };
  },
});

export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const viewer = await requireUser(ctx);
    const result = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (t) => {
        const pending = await ctx.db
          .query("loans")
          .withIndex("by_tool_status", (q) => q.eq("toolId", t._id).eq("status", "pending"))
          .collect();
        return { ...(await toToolView(ctx, t, viewer)), pendingRequests: pending.length };
      }),
    );
    return { ...result, page };
  },
});

export const get = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    return tool ? await toToolView(ctx, tool, viewer) : null;
  },
});

export const listAllAdmin = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()) },
  handler: async (ctx, { paginationOpts, search }) => {
    const viewer = await requireAdmin(ctx);
    const term = search?.trim();
    const q = term
      ? ctx.db.query("tools").withSearchIndex("search_name", (s) => s.search("name", term))
      : ctx.db.query("tools").withIndex("by_name");
    const result = await q.paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (t) => {
        const owner = await ctx.db.get(t.ownerId);
        return { ...(await toToolView(ctx, t, viewer)), ownerEmail: owner?.email ?? "" };
      }),
    );
    return { ...result, page };
  },
});
