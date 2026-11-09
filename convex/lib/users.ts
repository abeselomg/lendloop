import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { declinePendingLoansForTool } from "../automation/outbox";
import { isAdminEmail } from "./access";
import type { ClerkUserInput } from "./clerk";

export const DELETED_NAME = "Deleted user";
export const isDemoClerkId = (clerkId: string) => clerkId.startsWith("seed:");

/** Lowercased "name email", the field the users search index reads. Keep in sync on every name/email write. */
export const searchTextOf = (u: { name: string; email: string }) => `${u.name} ${u.email}`.toLowerCase();

/** Decline pending requests (with the normal notification) and delete the tool. Approved loans are left alone. */
export async function removeTool(ctx: MutationCtx, toolId: Id<"tools">): Promise<void> {
  await declinePendingLoansForTool(ctx, toolId);
  await ctx.db.delete(toolId);
}

export async function removeToolsOfUser(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  const tools = await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", userId)).collect();
  for (const tool of tools) await removeTool(ctx, tool._id);
  return tools.length;
}

/** Insert or update a user from Clerk data. Never demotes; skips accounts already marked deleted. */
export async function upsertClerkUser(
  ctx: MutationCtx,
  u: ClerkUserInput,
): Promise<"created" | "updated" | "skipped"> {
  const existing = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", u.clerkId)).unique();
  const admin = isAdminEmail(u.email);
  if (!existing) {
    await ctx.db.insert("users", {
      clerkId: u.clerkId,
      email: u.email,
      name: u.name,
      imageUrl: u.imageUrl,
      role: admin ? "admin" : "user",
      trustedLender: false,
      createdAt: Date.now(),
      searchText: searchTextOf(u),
    });
    return "created";
  }
  if (existing.deletedAt !== undefined) return "skipped";
  await ctx.db.patch(existing._id, {
    name: u.name,
    email: u.email,
    imageUrl: u.imageUrl,
    role: admin ? "admin" : existing.role,
    searchText: searchTextOf(u),
  });
  return "updated";
}
