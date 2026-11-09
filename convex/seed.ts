import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const TOOLS = [
  { name: "Cordless drill", category: "power_tools", condition: "good", description: "18V cordless drill with two batteries and a charger." },
  { name: "Socket wrench set", category: "hand_tools", condition: "good", description: "Metric and imperial socket set in a carrying case." },
  { name: "Hedge trimmer", category: "garden", condition: "fair", description: "Electric hedge trimmer with a 55cm blade." },
  { name: "Stand mixer", category: "kitchen", condition: "new", description: "5-litre stand mixer with whisk, hook and paddle." },
  { name: "4-person tent", category: "camping", condition: "good", description: "Waterproof four-person tent that pitches in ten minutes." },
  { name: "Carpet cleaner", category: "cleaning", condition: "fair", description: "Upright carpet cleaner, ideal for a weekend deep clean." },
  { name: "OBD-II scanner", category: "automotive", condition: "good", description: "Bluetooth OBD-II scanner for reading engine fault codes." },
  { name: "Folding ladder", category: "other", condition: "worn", description: "Aluminium folding ladder that reaches up to 4 metres." },
] as const;

export const demo = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.categories.internal.seedDefaults, {});
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", "seed:demo"))
      .unique();
    const userId =
      user?._id ??
      (await ctx.db.insert("users", {
        clerkId: "seed:demo",
        email: "demo@lendloop.local",
        name: "LendLoop Demo",
        role: "user",
        trustedLender: true,
        createdAt: Date.now(),
      }));
    const existing = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const names = new Set(existing.map((t) => t.name));
    let created = 0;
    for (const tool of TOOLS) {
      if (names.has(tool.name)) continue;
      await ctx.db.insert("tools", { ownerId: userId, ...tool, createdAt: Date.now() });
      created++;
    }
    return { created };
  },
});
