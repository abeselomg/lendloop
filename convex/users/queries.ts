import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { firstNameOf, getUserOrNull, isAdminEmail, requireAdmin } from "../lib/access";
import { isDemoClerkId } from "../lib/users";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserOrNull(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      firstName: firstNameOf(user),
      email: user.email,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});

export const listAll = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  },
  handler: async (ctx, { paginationOpts, search, role }) => {
    const me = await requireAdmin(ctx);
    const term = search?.trim().toLowerCase();
    const result = term
      ? await ctx.db
          .query("users")
          .withSearchIndex("search_text", (q) => {
            const s = q.search("searchText", term);
            return role ? s.eq("role", role) : s;
          })
          .paginate(paginationOpts)
      : role
        ? await ctx.db
            .query("users")
            .withIndex("by_role_name", (q) => q.eq("role", role))
            .paginate(paginationOpts)
        : await ctx.db.query("users").withIndex("by_name").paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((u) => ({
        _id: u._id,
        name: u.name,
        firstName: firstNameOf(u),
        email: u.email,
        role: u.role,
        trustedLender: u.trustedLender,
        createdAt: u.createdAt,
        isDemo: isDemoClerkId(u.clerkId),
        adminByConfig: isAdminEmail(u.email),
        deleted: u.deletedAt !== undefined,
        isMe: u._id === me._id,
      })),
    };
  },
});
