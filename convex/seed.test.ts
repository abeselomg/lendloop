import { describe, it, expect } from "vitest";
import { makeT } from "./test.setup";
import { internal } from "./_generated/api";

describe("seed.demo", () => {
  it("is idempotent", async () => {
    const t = makeT();
    const first = await t.mutation(internal.seed.demo, {});
    const second = await t.mutation(internal.seed.demo, {});
    expect(first).toEqual({ created: 8 });
    expect(second).toEqual({ created: 0 });
    await t.run(async (ctx) => {
      const tools = await ctx.db.query("tools").collect();
      const users = await ctx.db.query("users").collect();
      expect(tools).toHaveLength(8);
      expect(users).toHaveLength(1);
      expect(users[0].trustedLender).toBe(true);
      expect(tools.every((x) => x.ownerId === users[0]._id)).toBe(true);
    });
  });
});
