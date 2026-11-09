import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { isAdminEmail, requireAdmin } from "../lib/access";
import { isDemoClerkId, searchTextOf } from "../lib/users";

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
      await ctx.db.patch(existing._id, { name, email, imageUrl, role, searchText: searchTextOf({ name, email }) });
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
      searchText: searchTextOf({ name, email }),
    });
    return { userId, role };
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("user")) },
  handler: async (ctx, { userId, role }) => {
    const me = await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    if (target.deletedAt !== undefined) throw new ConvexError("This account was deleted");
    if (role === "admin") {
      if (isDemoClerkId(target.clerkId)) throw new ConvexError("The demo account can't be an admin");
      if (target.role !== "admin") await ctx.db.patch(userId, { role });
      return null;
    }
    if (target._id === me._id) throw new ConvexError("You can't remove your own admin role");
    if (isAdminEmail(target.email)) {
      throw new ConvexError("This person is an admin through the server's ADMIN_EMAILS setting");
    }
    if (target.role === "admin") {
      const admins = await ctx.db.query("users").withIndex("by_role_name", (q) => q.eq("role", "admin")).collect();
      if (admins.filter((a) => a.deletedAt === undefined).length <= 1) {
        throw new ConvexError("There must be at least one admin");
      }
      await ctx.db.patch(userId, { role });
    }
    return null;
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
