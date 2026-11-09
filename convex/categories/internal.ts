import { internalMutation } from "../_generated/server";
import { DEFAULT_CATEGORIES } from "../lib/validation";

/** Idempotent: inserts any default category whose slug is missing; never touches existing rows. */
export const seedDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (const c of DEFAULT_CATEGORIES) {
      const existing = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", c.slug)).unique();
      if (existing) continue;
      await ctx.db.insert("categories", { ...c, active: true, createdAt: Date.now() });
      created++;
    }
    return { created };
  },
});
