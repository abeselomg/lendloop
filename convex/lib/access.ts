import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AppUser = Doc<"users">;

export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const target = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}

export function firstNameOf(user: { name?: string; email: string }): string {
  const first = user.name?.trim().split(/\s+/)[0];
  return first || user.email.split("@")[0].split("+")[0];
}

export async function getUserOrNull(ctx: QueryCtx | MutationCtx): Promise<AppUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<AppUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not signed in");
  const user = await getUserOrNull(ctx);
  if (!user) throw new ConvexError("Account not initialized");
  return user;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<AppUser> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new ConvexError("Admin only");
  return user;
}
