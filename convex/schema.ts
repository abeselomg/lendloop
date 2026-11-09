import { defineSchema, defineTable } from "convex/server";
import { v, type Validator } from "convex/values";
import { CONDITIONS, EVENT_TYPES, LOAN_STATUSES, LOG_KINDS } from "./lib/validation";

const literals = <T extends readonly [string, string, ...string[]]>(arr: T) =>
  // v.union requires a non-empty tuple type; arr is non-empty by T's constraint, so the cast only
  // reconciles the mapped array with that tuple type (no runtime effect).
  v.union(
    ...(arr.map((x) => v.literal(x)) as unknown as [Validator<string>, Validator<string>, ...Validator<string>[]]),
  ) as unknown as Validator<T[number], "required">;

export const conditionValidator = literals(CONDITIONS);
export const loanStatusValidator = literals(LOAN_STATUSES);
export const eventTypeValidator = literals(EVENT_TYPES);
export const logKindValidator = literals(LOG_KINDS);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    trustedLender: v.boolean(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
    searchText: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_name", ["name"])
    .index("by_role_name", ["role", "name"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["role"] }),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: v.string(),
    condition: conditionValidator,
    description: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"])
    .index("by_name", ["name"])
    .index("by_category_name", ["category", "name"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["category"] }),

  categories: defineTable({
    slug: v.string(),
    label: v.string(),
    icon: v.string(),
    active: v.boolean(),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"]),

  loans: defineTable({
    toolId: v.id("tools"),
    toolName: v.string(),
    borrowerId: v.id("users"),
    lenderId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    note: v.optional(v.string()),
    status: loanStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    returnedAt: v.optional(v.number()),
    lastReminderAt: v.optional(v.number()),
    reminderCount: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_lender", ["lenderId"])
    .index("by_lender_status", ["lenderId", "status"])
    .index("by_status", ["status"])
    .index("by_tool_status", ["toolId", "status"]),

  automationEvents: defineTable({
    loanId: v.id("loans"),
    type: eventTypeValidator,
    recipientUserId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_loan", ["loanId"])
    .index("by_status", ["status"]),

  automationLog: defineTable({
    loanId: v.optional(v.id("loans")),
    kind: logKindValidator,
    source: v.union(v.literal("convex"), v.literal("n8n")),
    message: v.string(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    meta: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
  })
    .index("by_loan", ["loanId"])
    .index("by_key", ["idempotencyKey"])
    .index("by_kind", ["kind"]),
});
