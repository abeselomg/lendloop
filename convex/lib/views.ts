import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Category, Condition, LogKind, LoanStatus } from "./validation";
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

export type ActivityEntry = {
  _id: Id<"automationLog">;
  kind: LogKind;
  source: "convex" | "n8n";
  message: string;
  createdAt: number;
  meta?: Record<string, string | number | boolean>;
};

export type LoanView = {
  _id: Id<"loans">;
  status: LoanStatus;
  startDate: string;
  endDate: string;
  note?: string;
  toolId: Id<"tools">;
  toolName: string;
  toolExists: boolean;
  createdAt: number;
  updatedAt: number;
  returnedAt?: number;
  lastReminderAt?: number;
  reminderCount: number;
  viewerRole: "borrower" | "lender" | "admin";
  borrower: { firstName: string; trustedLender: boolean };
  lender: { firstName: string; trustedLender: boolean };
  activity: ActivityEntry[];
};

export async function toLoanView(ctx: QueryCtx, loan: Doc<"loans">, viewer: AppUser): Promise<LoanView> {
  const [borrower, lender, tool, logs] = await Promise.all([
    ctx.db.get(loan.borrowerId),
    ctx.db.get(loan.lenderId),
    ctx.db.get(loan.toolId),
    ctx.db.query("automationLog").withIndex("by_loan", (q) => q.eq("loanId", loan._id)).order("desc").take(5),
  ]);
  const person = (u: Doc<"users"> | null) =>
    u ? { firstName: firstNameOf(u), trustedLender: u.trustedLender } : { firstName: "Unknown", trustedLender: false };
  return {
    _id: loan._id,
    status: loan.status,
    startDate: loan.startDate,
    endDate: loan.endDate,
    note: loan.note,
    toolId: loan.toolId,
    toolName: loan.toolName,
    toolExists: tool !== null,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    returnedAt: loan.returnedAt,
    lastReminderAt: loan.lastReminderAt,
    reminderCount: loan.reminderCount,
    viewerRole: loan.borrowerId === viewer._id ? "borrower" : loan.lenderId === viewer._id ? "lender" : "admin",
    borrower: person(borrower),
    lender: person(lender),
    activity: logs.map((l) => ({
      _id: l._id,
      kind: l.kind,
      source: l.source,
      message: l.message,
      createdAt: l.createdAt,
      meta: l.meta,
    })),
  };
}
