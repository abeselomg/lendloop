import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { categoryValidator, conditionValidator } from "./schema";
import { requireAdmin, requireUser } from "./lib/access";
import { validateToolInput } from "./lib/validation";
import { declinePendingLoansForTool } from "./automation";
import { isToolOnLoan, toToolView } from "./lib/views";

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

const toolInput = {
  name: v.string(),
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
};

function cleanInput(input: { name: string; category: string; condition: string; description: string }) {
  const err = validateToolInput(input);
  if (err) throw new ConvexError(err);
  return { name: input.name.trim(), description: input.description.trim() };
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").collect();
    const out: { _id: (typeof tools)[number]["_id"]; name: string; category: (typeof tools)[number]["category"] }[] = [];
    for (const t of tools) {
      if (await isToolOnLoan(ctx, t._id)) continue;
      out.push({ _id: t._id, name: t.name, category: t.category });
    }
    return out.sort(byName);
  },
});

export const list = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const viewer = await requireUser(ctx);
    const tools = category
      ? await ctx.db.query("tools").withIndex("by_category", (q) => q.eq("category", category)).collect()
      : await ctx.db.query("tools").collect();
    const views = await Promise.all(tools.map((t) => toToolView(ctx, t, viewer)));
    return views.sort(byName);
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const tools = await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", viewer._id)).collect();
    const out = await Promise.all(
      tools.map(async (t) => {
        const pending = await ctx.db
          .query("loans")
          .withIndex("by_tool_status", (q) => q.eq("toolId", t._id).eq("status", "pending"))
          .collect();
        return { ...(await toToolView(ctx, t, viewer)), pendingRequests: pending.length };
      }),
    );
    return out.sort(byName);
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

export const create = mutation({
  args: toolInput,
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const clean = cleanInput(args);
    return await ctx.db.insert("tools", {
      ownerId: owner._id,
      name: clean.name,
      category: args.category,
      condition: args.condition,
      description: clean.description,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolInput },
  handler: async (ctx, { toolId, ...args }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.ownerId !== user._id) throw new ConvexError("Not your listing");
    const clean = cleanInput(args);
    await ctx.db.patch(toolId, {
      name: clean.name,
      category: args.category,
      condition: args.condition,
      description: clean.description,
    });
    return null;
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || (tool.ownerId !== user._id && user.role !== "admin")) throw new ConvexError("Not your listing");
    await declinePendingLoansForTool(ctx, toolId);
    await ctx.db.delete(toolId);
    return null;
  },
});

export const listAllAdmin = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAdmin(ctx);
    const tools = await ctx.db.query("tools").collect();
    const out = await Promise.all(
      tools.map(async (t) => {
        const owner = await ctx.db.get(t.ownerId);
        return { ...(await toToolView(ctx, t, viewer)), ownerEmail: owner?.email ?? "" };
      }),
    );
    return out.sort(byName);
  },
});
