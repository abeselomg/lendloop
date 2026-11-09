import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/access";
import { isCategoryIcon, slugifyCategory, validateCategoryLabel } from "../lib/validation";

function checkIcon(icon: string) {
  if (!isCategoryIcon(icon)) throw new ConvexError("Choose a valid icon");
}

function checkLabel(label: string) {
  const err = validateCategoryLabel(label);
  if (err) throw new ConvexError(err);
}

export const create = mutation({
  args: { label: v.string(), icon: v.string() },
  handler: async (ctx, { label, icon }) => {
    await requireAdmin(ctx);
    checkLabel(label);
    checkIcon(icon);
    const slug = slugifyCategory(label);
    const dup = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (dup) throw new ConvexError("A category with that name already exists");
    const last = await ctx.db.query("categories").withIndex("by_order").order("desc").first();
    return await ctx.db.insert("categories", {
      slug,
      label: label.trim(),
      icon,
      active: true,
      order: (last?.order ?? 0) + 10,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { id: v.id("categories"), label: v.optional(v.string()), icon: v.optional(v.string()), order: v.optional(v.number()) },
  handler: async (ctx, { id, label, icon, order }) => {
    await requireAdmin(ctx);
    const cat = await ctx.db.get(id);
    if (!cat) throw new ConvexError("Category not found");
    const patch: { label?: string; icon?: string; order?: number } = {};
    if (label !== undefined) {
      checkLabel(label);
      patch.label = label.trim();
    }
    if (icon !== undefined) {
      checkIcon(icon);
      patch.icon = icon;
    }
    if (order !== undefined) patch.order = order;
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const setActive = mutation({
  args: { id: v.id("categories"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(id))) throw new ConvexError("Category not found");
    await ctx.db.patch(id, { active });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const cat = await ctx.db.get(id);
    if (!cat) throw new ConvexError("Category not found");
    const tools = await ctx.db.query("tools").withIndex("by_category", (q) => q.eq("category", cat.slug)).collect();
    if (tools.length > 0) {
      throw new ConvexError(`Category is in use by ${tools.length} tools — archive it instead`);
    }
    await ctx.db.delete(id);
    return null;
  },
});
