import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { requireAdmin } from "../lib/access";
import { clerkUserValidator } from "../lib/clerk";
import { DELETED_NAME, isDemoClerkId, removeToolsOfUser, searchTextOf, upsertClerkUser } from "../lib/users";

/** Admin gate for actions (ctx.auth is propagated to runQuery). Optionally resolves the target user. */
export const adminTarget = internalQuery({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    if (!userId) return null;
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    return {
      clerkId: target.clerkId,
      demo: isDemoClerkId(target.clerkId),
      deleted: target.deletedAt !== undefined,
    };
  },
});

export const setName = internalMutation({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, { userId, name }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");
    await ctx.db.patch(userId, { name, searchText: searchTextOf({ name, email: user.email }) });
    return null;
  },
});

export const upsertFromClerk = internalMutation({
  args: { users: v.array(clerkUserValidator) },
  handler: async (ctx, { users }) => {
    let created = 0;
    let updated = 0;
    for (const u of users) {
      const r = await upsertClerkUser(ctx, u);
      if (r === "created") created++;
      else if (r === "updated") updated++;
    }
    return { created, updated };
  },
});

/** Clerk user.deleted: keep the row (history), blank the name, remove their tools. Idempotent. */
export const markDeleted = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    if (!user || user.deletedAt !== undefined) return { removedTools: 0 };
    await ctx.db.patch(user._id, {
      deletedAt: Date.now(),
      name: DELETED_NAME,
      imageUrl: undefined,
      searchText: searchTextOf({ name: DELETED_NAME, email: user.email }),
    });
    return { removedTools: await removeToolsOfUser(ctx, user._id) };
  },
});

/** Idempotent: fills searchText for rows that lack it. Run once on existing deployments. */
export const backfillSearchText = internalMutation({
  args: {},
  handler: async (ctx) => {
    let filled = 0;
    for await (const u of ctx.db.query("users")) {
      if (u.searchText !== undefined) continue;
      await ctx.db.patch(u._id, { searchText: searchTextOf(u) });
      filled++;
    }
    return { filled };
  },
});
