import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { FIRST_PAGE, makeT, signIn } from "../test.setup";

const P = { paginationOpts: FIRST_PAGE };
const base = { name: "Cordless Drill", category: "power_tools" as const, condition: "good" as const, description: "18V" };

describe("tools", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("listPublic exposes only _id/name/category and works signed out", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    await alice.mutation(api.tools.mutations.create, base);
    const items = (await t.query(api.tools.queries.listPublic, P)).page;
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]).sort()).toEqual(["_id", "category", "name"]);
  });

  it("create validates input", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    await expect(alice.mutation(api.tools.mutations.create, { ...base, name: "x" })).rejects.toThrow("Name must be 2");
  });

  it("update by non-owner rejected; owner succeeds", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const id = await alice.mutation(api.tools.mutations.create, base);
    await expect(bob.mutation(api.tools.mutations.update, { toolId: id, ...base, name: "Hijack" })).rejects.toThrow("Not your listing");
    await alice.mutation(api.tools.mutations.update, { toolId: id, ...base, name: "  Impact Driver  " });
    const got = await alice.query(api.tools.queries.get, { toolId: id });
    expect(got?.name).toBe("Impact Driver");
  });

  it("remove by non-owner rejected; admin succeeds", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const admin = await signIn(t, "admin");
    const id = await alice.mutation(api.tools.mutations.create, base);
    await expect(bob.mutation(api.tools.mutations.remove, { toolId: id })).rejects.toThrow("Not your listing");
    await admin.mutation(api.tools.mutations.remove, { toolId: id });
    expect(await alice.query(api.tools.queries.get, { toolId: id })).toBeNull();
  });

  it("list filters by category and marks onLoan after an approved loan", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const drill = await alice.mutation(api.tools.mutations.create, base);
    await alice.mutation(api.tools.mutations.create, { ...base, name: "Rake", category: "garden" });
    const garden = (await bob.query(api.tools.queries.list, { ...P, category: "garden" })).page;
    expect(garden.map((x) => x.name)).toEqual(["Rake"]);
    expect(garden[0].owner).toMatchObject({ firstName: "Alice", isMe: false, trustedLender: false });
    await t.run(async (ctx) => {
      const tool = (await ctx.db.get(drill))!;
      const b = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "clerk_bob")).unique();
      await ctx.db.insert("loans", {
        toolId: drill, toolName: tool.name, borrowerId: b!._id, lenderId: tool.ownerId,
        startDate: "2026-11-08", endDate: "2026-11-10", status: "approved",
        createdAt: 1, updatedAt: 1, reminderCount: 0,
      });
    });
    const all = (await bob.query(api.tools.queries.list, P)).page;
    expect(all.find((x) => x.name === "Cordless Drill")?.onLoan).toBe(true);
    expect(all.find((x) => x.name === "Rake")?.onLoan).toBe(false);
    expect((await t.query(api.tools.queries.listPublic, P)).page.map((x) => x.name)).toEqual(["Rake"]);
  });

  it("mine returns only my tools with pendingRequests count", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const id = await alice.mutation(api.tools.mutations.create, base);
    await bob.mutation(api.tools.mutations.create, { ...base, name: "Bob Saw" });
    await t.run(async (ctx) => {
      const tool = (await ctx.db.get(id))!;
      const b = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "clerk_bob")).unique();
      await ctx.db.insert("loans", {
        toolId: id, toolName: tool.name, borrowerId: b!._id, lenderId: tool.ownerId,
        startDate: "2026-11-08", endDate: "2026-11-10", status: "pending",
        createdAt: 1, updatedAt: 1, reminderCount: 0,
      });
    });
    const mine = (await alice.query(api.tools.queries.mine, P)).page;
    expect(mine).toHaveLength(1);
    expect(mine[0].pendingRequests).toBe(1);
    expect(mine[0].owner.isMe).toBe(true);
  });

  it("create rejects unknown and archived categories; update may keep an archived one", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const admin = await signIn(t, "admin");
    await expect(alice.mutation(api.tools.mutations.create, { ...base, category: "nope" })).rejects.toThrow("Choose a valid category");
    const id = await alice.mutation(api.tools.mutations.create, base);
    const cats = await t.query(api.categories.queries.list, {});
    const power = cats.find((c) => c.slug === "power_tools")!;
    await admin.mutation(api.categories.mutations.setActive, { id: power._id, active: false });
    await expect(alice.mutation(api.tools.mutations.create, base)).rejects.toThrow("Choose a valid category");
    await alice.mutation(api.tools.mutations.update, { toolId: id, ...base, name: "Renamed drill" });
    expect((await alice.query(api.tools.queries.get, { toolId: id }))?.category).toBe("power_tools");
    await expect(alice.mutation(api.tools.mutations.update, { toolId: id, ...base, category: "nope" })).rejects.toThrow("Choose a valid category");
    await alice.mutation(api.tools.mutations.update, { toolId: id, ...base, category: "garden" });
    await expect(alice.mutation(api.tools.mutations.update, { toolId: id, ...base })).rejects.toThrow("Choose a valid category");
  });

  it("list paginates with isDone/continueCursor in name order", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    for (const name of ["Delta", "Alpha", "Charlie", "Bravo", "Echo"]) {
      await alice.mutation(api.tools.mutations.create, { ...base, name });
    }
    const first = await alice.query(api.tools.queries.list, { paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page.map((x) => x.name)).toEqual(["Alpha", "Bravo"]);
    expect(first.isDone).toBe(false);
    const second = await alice.query(api.tools.queries.list, { paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(second.page.map((x) => x.name)).toEqual(["Charlie", "Delta"]);
    const third = await alice.query(api.tools.queries.list, { paginationOpts: { numItems: 2, cursor: second.continueCursor } });
    expect(third.page.map((x) => x.name)).toEqual(["Echo"]);
    expect(third.isDone).toBe(true);
  });

  it("list search finds by name and respects the category filter", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    await alice.mutation(api.tools.mutations.create, { ...base, name: "Cordless drill" });
    await alice.mutation(api.tools.mutations.create, { ...base, name: "Garden drill", category: "garden" });
    await alice.mutation(api.tools.mutations.create, { ...base, name: "Rake", category: "garden" });
    const names = async (args: { search?: string; category?: string }) =>
      (await alice.query(api.tools.queries.list, { ...P, ...args })).page.map((x) => x.name).sort();
    expect(await names({ search: "drill" })).toEqual(["Cordless drill", "Garden drill"]);
    expect(await names({ search: "  drill ", category: "garden" })).toEqual(["Garden drill"]);
    expect(await names({ search: "   " })).toEqual(["Cordless drill", "Garden drill", "Rake"]);
    expect(await names({ search: "hammer" })).toEqual([]);
  });

  it("listAllAdmin is admin-only, paginated and searchable", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const admin = await signIn(t, "admin");
    await alice.mutation(api.tools.mutations.create, base);
    await alice.mutation(api.tools.mutations.create, { ...base, name: "Rake", category: "garden" });
    await expect(alice.query(api.tools.queries.listAllAdmin, P)).rejects.toThrow("Admin only");
    const all = await admin.query(api.tools.queries.listAllAdmin, { paginationOpts: { numItems: 1, cursor: null } });
    expect(all.page).toHaveLength(1);
    expect(all.isDone).toBe(false);
    expect(all.page[0].ownerEmail).toBe("alice@example.com");
    const found = await admin.query(api.tools.queries.listAllAdmin, { ...P, search: "rake" });
    expect(found.page.map((x) => x.name)).toEqual(["Rake"]);
  });

  it("mine paginates newest first and never includes other owners", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const ids: Id<"tools">[] = [];
    for (const name of ["One", "Two", "Three"]) ids.push(await alice.mutation(api.tools.mutations.create, { ...base, name }));
    await bob.mutation(api.tools.mutations.create, { ...base, name: "Bob's" });
    const first = await alice.query(api.tools.queries.mine, { paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page.map((x) => x._id)).toEqual([ids[2], ids[1]]);
    expect(first.isDone).toBe(false);
    const rest = await alice.query(api.tools.queries.mine, { paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(rest.page.map((x) => x._id)).toEqual([ids[0]]);
  });
});
