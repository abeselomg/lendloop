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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      firstName: firstNameOf(u),
      email: u.email,
      role: u.role,
      trustedLender: u.trustedLender,
      createdAt: u.createdAt,
    }));
  },
});
