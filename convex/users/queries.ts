import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { firstNameOf, getUserOrNull, requireAdmin } from "../lib/access";

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
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db.query("users").withIndex("by_name").paginate(paginationOpts);
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
      })),
    };
  },
});
