import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../_generated/api";
import { DEFAULT_CATEGORIES } from "../lib/validation";
import { makeT, signIn } from "../test.setup";

describe("categories", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("seedDefaults is idempotent and does not overwrite edits", async () => {
    const t = makeT();
    expect(await t.mutation(internal.categories.internal.seedDefaults, {})).toEqual({ created: DEFAULT_CATEGORIES.length });
    const admin = await signIn(t, "admin"); // signIn seeds again: must be a no-op
    expect(await t.mutation(internal.categories.internal.seedDefaults, {})).toEqual({ created: 0 });
    const list = await t.query(api.categories.queries.list, {});
    expect(list).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(list.map((c) => c.slug)).toEqual(DEFAULT_CATEGORIES.map((c) => c.slug));
    await admin.mutation(api.categories.mutations.update, { id: list[0]._id, label: "Renamed" });
    await t.mutation(internal.categories.internal.seedDefaults, {});
    expect((await t.query(api.categories.queries.list, {}))[0].label).toBe("Renamed");
  });

  it("list is public, sorted by order and reports toolCount", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    await alice.mutation(api.tools.mutations.create, {
      name: "Rake", category: "garden", condition: "good", description: "",
    });
    const list = await t.query(api.categories.queries.list, {});
    expect(list.map((c) => c.order)).toEqual([...list.map((c) => c.order)].sort((a, b) => a - b));
    expect(list.find((c) => c.slug === "garden")).toMatchObject({ toolCount: 1, active: true, icon: "garden", label: "Garden" });
    expect(list.find((c) => c.slug === "kitchen")?.toolCount).toBe(0);
  });

  it("every mutation rejects non-admins and signed-out callers", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const id = (await t.query(api.categories.queries.list, {}))[0]._id;
    await expect(alice.mutation(api.categories.mutations.create, { label: "Toys", icon: "other" })).rejects.toThrow("Admin only");
    await expect(alice.mutation(api.categories.mutations.update, { id, label: "Hacked" })).rejects.toThrow("Admin only");
    await expect(alice.mutation(api.categories.mutations.setActive, { id, active: false })).rejects.toThrow("Admin only");
    await expect(alice.mutation(api.categories.mutations.remove, { id })).rejects.toThrow("Admin only");
    await expect(t.mutation(api.categories.mutations.create, { label: "Toys", icon: "other" })).rejects.toThrow("Not signed in");
  });

  it("create derives a unique slug, appends order and validates input", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    const id = await admin.mutation(api.categories.mutations.create, { label: "  Board Games ", icon: "other" });
    const created = (await t.query(api.categories.queries.list, {})).find((c) => c._id === id)!;
    expect(created).toMatchObject({ slug: "board_games", label: "Board Games", active: true, order: 90, toolCount: 0 });
    await expect(admin.mutation(api.categories.mutations.create, { label: "board games", icon: "other" })).rejects.toThrow(
      "A category with that name already exists",
    );
    await expect(admin.mutation(api.categories.mutations.create, { label: "Garden", icon: "garden" })).rejects.toThrow("already exists");
    await expect(admin.mutation(api.categories.mutations.create, { label: "x", icon: "other" })).rejects.toThrow("2–30");
    await expect(admin.mutation(api.categories.mutations.create, { label: "Toys", icon: "rocket" })).rejects.toThrow("Choose a valid icon");
  });

  it("update changes label/icon/order but never the slug", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    const id = (await t.query(api.categories.queries.list, {})).find((c) => c.slug === "garden")!._id;
    await admin.mutation(api.categories.mutations.update, { id, label: "Yard", icon: "camping", order: 5 });
    const c = (await t.query(api.categories.queries.list, {}))[0];
    expect(c).toMatchObject({ slug: "garden", label: "Yard", icon: "camping", order: 5 });
    await expect(admin.mutation(api.categories.mutations.update, { id, icon: "bad" })).rejects.toThrow("Choose a valid icon");
  });

  it("remove refuses a category in use, but deletes an unused one", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const admin = await signIn(t, "admin");
    await alice.mutation(api.tools.mutations.create, { name: "Rake", category: "garden", condition: "good", description: "" });
    const list = await t.query(api.categories.queries.list, {});
    const garden = list.find((c) => c.slug === "garden")!;
    const kitchen = list.find((c) => c.slug === "kitchen")!;
    await expect(admin.mutation(api.categories.mutations.remove, { id: garden._id })).rejects.toThrow(
      "Category is in use by 1 tools — archive it instead",
    );
    await admin.mutation(api.categories.mutations.remove, { id: kitchen._id });
    expect((await t.query(api.categories.queries.list, {})).some((c) => c.slug === "kitchen")).toBe(false);
  });

  it("archived categories stay in list with active false and can be restored", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    const id = (await t.query(api.categories.queries.list, {}))[0]._id;
    await admin.mutation(api.categories.mutations.setActive, { id, active: false });
    expect((await t.query(api.categories.queries.list, {}))[0].active).toBe(false);
    await admin.mutation(api.categories.mutations.setActive, { id, active: true });
    expect((await t.query(api.categories.queries.list, {}))[0].active).toBe(true);
  });
});
