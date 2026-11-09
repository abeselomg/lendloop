import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { isAdminEmail, requireAdmin } from "../lib/access";

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not signed in");
    if (!identity.email) throw new ConvexError("Your account has no email on its Clerk token");
    const email = identity.email;
    const name =
      identity.name ?? [identity.givenName, identity.familyName].filter(Boolean).join(" ");
    const imageUrl = identity.pictureUrl;
    const admin = isAdminEmail(email);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) {
      const role = admin ? "admin" : existing.role;
      await ctx.db.patch(existing._id, { name, email, imageUrl, role });
      return { userId: existing._id, role };
    }
    const role = admin ? ("admin" as const) : ("user" as const);
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email,
      name,
      imageUrl,
      role,
      trustedLender: false,
      createdAt: Date.now(),
    });
    return { userId, role };
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    await ctx.db.patch(userId, { trustedLender: trusted });
    return null;
  },
});
