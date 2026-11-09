import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { parseClerkUser, type ClerkUserInput } from "../lib/clerk";

const CLERK_API = "https://api.clerk.com/v1";
const NOT_CONFIGURED = "Name editing isn't configured on this server";
const MAX_NAME = 50;

function clerkKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new ConvexError(NOT_CONFIGURED);
  return key;
}

async function clerkFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${clerkKey()}`, "content-type": "application/json" },
  });
  // Never echo Clerk's body; it can contain account details.
  if (!res.ok) throw new ConvexError(`Clerk rejected the change (${res.status})`);
  return res;
}

export const updateName = action({
  args: { userId: v.id("users"), firstName: v.string(), lastName: v.string() },
  handler: async (ctx, { userId, firstName, lastName }): Promise<null> => {
    const target = await ctx.runQuery(internal.users.internal.adminTarget, { userId });
    if (!target) throw new ConvexError("User not found");
    if (target.demo) throw new ConvexError("The demo account can't be renamed");
    if (target.deleted) throw new ConvexError("This account was deleted");
    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length < 1 || first.length > MAX_NAME) {
      throw new ConvexError(`First name must be 1-${MAX_NAME} characters`);
    }
    if (last.length > MAX_NAME) throw new ConvexError(`Last name must be at most ${MAX_NAME} characters`);
    await clerkFetch(`/users/${encodeURIComponent(target.clerkId)}`, {
      method: "PATCH",
      body: JSON.stringify({ first_name: first, last_name: last }),
    });
    await ctx.runMutation(internal.users.internal.setName, { userId, name: [first, last].filter(Boolean).join(" ") });
    return null;
  },
});

const PAGE = 100;
const MAX_PAGES = 100;

export const syncFromClerk = action({
  args: {},
  handler: async (ctx): Promise<{ created: number; updated: number }> => {
    await ctx.runQuery(internal.users.internal.adminTarget, {});
    let created = 0;
    let updated = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await clerkFetch(`/users?limit=${PAGE}&offset=${page * PAGE}&order_by=%2Bcreated_at`);
      const rows: unknown = await res.json();
      if (!Array.isArray(rows)) throw new ConvexError("Clerk returned an unexpected response");
      const users = rows.map(parseClerkUser).filter((u): u is ClerkUserInput => u !== null);
      const r = await ctx.runMutation(internal.users.internal.upsertFromClerk, { users });
      created += r.created;
      updated += r.updated;
      if (rows.length < PAGE) break;
    }
    return { created, updated };
  },
});
