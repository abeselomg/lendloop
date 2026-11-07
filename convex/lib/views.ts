import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Category, Condition } from "./validation";
import { firstNameOf, type AppUser } from "./access";

export type ToolView = {
  _id: Id<"tools">;
  name: string;
  category: Category;
  condition: Condition;
  description: string;
  createdAt: number;
  onLoan: boolean;
  owner: { firstName: string; trustedLender: boolean; isMe: boolean };
};

export async function isToolOnLoan(ctx: QueryCtx, toolId: Id<"tools">): Promise<boolean> {
  const loan = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .first();
  return loan !== null;
}

export async function toToolView(ctx: QueryCtx, tool: Doc<"tools">, viewer: AppUser): Promise<ToolView> {
  const owner = await ctx.db.get(tool.ownerId);
  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
    createdAt: tool.createdAt,
    onLoan: await isToolOnLoan(ctx, tool._id),
    owner: owner
      ? { firstName: firstNameOf(owner), trustedLender: owner.trustedLender, isMe: owner._id === viewer._id }
      : { firstName: "Unknown", trustedLender: false, isMe: false },
  };
}
