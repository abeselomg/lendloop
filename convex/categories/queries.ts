import { query } from "../_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const cats = await ctx.db.query("categories").collect();
    cats.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return await Promise.all(
      cats.map(async (c) => {
        const tools = await ctx.db.query("tools").withIndex("by_category", (q) => q.eq("category", c.slug)).collect();
        return { _id: c._id, slug: c.slug, label: c.label, icon: c.icon, active: c.active, order: c.order, toolCount: tools.length };
      }),
    );
  },
});
