import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { makeT, signIn } from "./test.setup";

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
    await alice.mutation(api.tools.create, base);
    const items = await t.query(api.tools.listPublic, {});
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]).sort()).toEqual(["_id", "category", "name"]);
  });

  it("create validates input", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    await expect(alice.mutation(api.tools.create, { ...base, name: "x" })).rejects.toThrow("Name must be 2");
  });

  it("update by non-owner rejected; owner succeeds", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const id = await alice.mutation(api.tools.create, base);
    await expect(bob.mutation(api.tools.update, { toolId: id, ...base, name: "Hijack" })).rejects.toThrow("Not your listing");
    await alice.mutation(api.tools.update, { toolId: id, ...base, name: "  Impact Driver  " });
    const got = await alice.query(api.tools.get, { toolId: id });
    expect(got?.name).toBe("Impact Driver");
  });

  it("remove by non-owner rejected; admin succeeds", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const admin = await signIn(t, "admin");
    const id = await alice.mutation(api.tools.create, base);
    await expect(bob.mutation(api.tools.remove, { toolId: id })).rejects.toThrow("Not your listing");
    await admin.mutation(api.tools.remove, { toolId: id });
    expect(await alice.query(api.tools.get, { toolId: id })).toBeNull();
  });

  it("list filters by category and marks onLoan after an approved loan", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const drill = await alice.mutation(api.tools.create, base);
    await alice.mutation(api.tools.create, { ...base, name: "Rake", category: "garden" });
    const garden = await bob.query(api.tools.list, { category: "garden" });
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
    const all = await bob.query(api.tools.list, {});
    expect(all.find((x) => x.name === "Cordless Drill")?.onLoan).toBe(true);
    expect(all.find((x) => x.name === "Rake")?.onLoan).toBe(false);
    expect((await t.query(api.tools.listPublic, {})).map((x) => x.name)).toEqual(["Rake"]);
  });

  it("mine returns only my tools with pendingRequests count", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const id = await alice.mutation(api.tools.create, base);
    await bob.mutation(api.tools.create, { ...base, name: "Bob Saw" });
    await t.run(async (ctx) => {
      const tool = (await ctx.db.get(id))!;
      const b = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "clerk_bob")).unique();
      await ctx.db.insert("loans", {
        toolId: id, toolName: tool.name, borrowerId: b!._id, lenderId: tool.ownerId,
        startDate: "2026-11-08", endDate: "2026-11-10", status: "pending",
        createdAt: 1, updatedAt: 1, reminderCount: 0,
      });
    });
    const mine = await alice.query(api.tools.mine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].pendingRequests).toBe(1);
    expect(mine[0].owner.isMe).toBe(true);
  });
});
