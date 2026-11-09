import { ConvexError, v } from "convex/values";
import { mutation, type QueryCtx } from "../_generated/server";
import { conditionValidator } from "../schema";
import { requireUser } from "../lib/access";
import { validateToolInput } from "../lib/validation";
import { declinePendingLoansForTool } from "../automation/outbox";

const toolInput = {
  name: v.string(),
  category: v.string(),
  condition: conditionValidator,
  description: v.string(),
};

function cleanInput(input: { name: string; category: string; condition: string; description: string }) {
  const err = validateToolInput(input);
  if (err) throw new ConvexError(err);
  return { name: input.name.trim(), description: input.description.trim() };
}

async function assertCategoryAllowed(ctx: QueryCtx, slug: string, current?: string) {
  if (current !== undefined && slug === current) return;
  const cat = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
  if (!cat || !cat.active) throw new ConvexError("Choose a valid category");
}

export const create = mutation({
  args: toolInput,
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const clean = cleanInput(args);
    await assertCategoryAllowed(ctx, args.category);
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
    await assertCategoryAllowed(ctx, args.category, tool.category);
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
