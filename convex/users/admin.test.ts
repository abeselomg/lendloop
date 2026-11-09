import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { svixSignature } from "../lib/svix";
import { FIRST_PAGE, identities, makeT, signIn } from "../test.setup";

const WH_SECRET = "whsec_" + btoa("webhook-secret-bytes");
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

type T = ReturnType<typeof makeT>;

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const idOf = async (t: T, email: string) =>
  (await t.run((ctx) => ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique()))!._id;

async function promote(t: T, email: string) {
  const id = await idOf(t, email);
  await t.run((ctx) => ctx.db.patch(id, { role: "admin" }));
  return id;
}

describe("setRole", () => {
  it("rejects non-admins", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bobId = (await signIn(t, "bob"), await idOf(t, "bob@example.com"));
    await expect(alice.mutation(api.users.mutations.setRole, { userId: bobId, role: "admin" })).rejects.toThrow(
      "Admin only",
    );
  });

  it("promotes and demotes, promotion is idempotent", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "bob");
    const bobId = await idOf(t, "bob@example.com");
    await admin.mutation(api.users.mutations.setRole, { userId: bobId, role: "admin" });
    await admin.mutation(api.users.mutations.setRole, { userId: bobId, role: "admin" });
    expect((await t.run((ctx) => ctx.db.get(bobId)))!.role).toBe("admin");
    await admin.mutation(api.users.mutations.setRole, { userId: bobId, role: "user" });
    expect((await t.run((ctx) => ctx.db.get(bobId)))!.role).toBe("user");
  });

  it("a DB-granted admin survives ensure", async () => {
    const t = makeT();
    await signIn(t, "bob");
    await promote(t, "bob@example.com");
    const r = await t.withIdentity(identities.bob).mutation(api.users.mutations.ensure, {});
    expect(r.role).toBe("admin");
  });

  it("refuses self-demotion", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    const me = await idOf(t, "admin@example.com");
    await expect(admin.mutation(api.users.mutations.setRole, { userId: me, role: "user" })).rejects.toThrow(
      "You can't remove your own admin role",
    );
  });

  it("refuses to demote a config admin", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "bob");
    const bobId = await promote(t, "bob@example.com");
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com,bob@example.com");
    await expect(admin.mutation(api.users.mutations.setRole, { userId: bobId, role: "user" })).rejects.toThrow(
      "This person is an admin through the server's ADMIN_EMAILS setting",
    );
  });

  it("refuses to demote the last non-deleted admin", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "bob");
    const bobId = await promote(t, "bob@example.com");
    // The caller's own row is deleted, so bob is the only live admin.
    const adminId = await idOf(t, "admin@example.com");
    await t.run((ctx) => ctx.db.patch(adminId, { deletedAt: Date.now() }));
    await expect(admin.mutation(api.users.mutations.setRole, { userId: bobId, role: "user" })).rejects.toThrow(
      "There must be at least one admin",
    );
  });

  it("refuses deleted and demo accounts", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "bob");
    const bobId = await idOf(t, "bob@example.com");
    await t.mutation(internal.seed.demo, {});
    const demoId = (await t.run((ctx) => ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "seed:demo")).unique()))!._id;
    await expect(admin.mutation(api.users.mutations.setRole, { userId: demoId, role: "admin" })).rejects.toThrow(
      "The demo account can't be an admin",
    );
    await t.run((ctx) => ctx.db.patch(bobId, { deletedAt: Date.now() }));
    await expect(admin.mutation(api.users.mutations.setRole, { userId: bobId, role: "admin" })).rejects.toThrow(
      "This account was deleted",
    );
  });
});

describe("listAll", () => {
  it("searches by name or email, filters by role, and flags rows", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "alice");
    await signIn(t, "bob");
    await t.mutation(internal.seed.demo, {});
    const bobId = await idOf(t, "bob@example.com");
    await t.run((ctx) => ctx.db.patch(bobId, { deletedAt: Date.now() }));

    const all = (await admin.query(api.users.queries.listAll, { paginationOpts: FIRST_PAGE })).page;
    expect(all).toHaveLength(4);
    const byEmail = (e: string) => all.find((u) => u.email === e)!;
    expect(byEmail("admin@example.com")).toMatchObject({ isMe: true, adminByConfig: true, isDemo: false, deleted: false });
    expect(byEmail("alice@example.com")).toMatchObject({ isMe: false, adminByConfig: false });
    expect(byEmail("bob@example.com").deleted).toBe(true);
    expect(byEmail("demo@lendloop.local").isDemo).toBe(true);

    const q = (args: { search?: string; role?: "admin" | "user" }) =>
      admin.query(api.users.queries.listAll, { paginationOpts: FIRST_PAGE, ...args }).then((r) => r.page.map((u) => u.email));
    expect(await q({ search: "alice" })).toEqual(["alice@example.com"]);
    expect(await q({ search: "Ada" })).toEqual(["admin@example.com"]);
    expect(await q({ search: "jones" })).toEqual(["bob@example.com"]);
    expect(await q({ search: "alice", role: "admin" })).toEqual([]);
    expect(await q({ role: "admin" })).toEqual(["admin@example.com"]);
    expect((await q({ role: "user" })).sort()).toEqual(["alice@example.com", "bob@example.com", "demo@lendloop.local"]);
    expect(await q({ search: "   " })).toHaveLength(4);
  });

  it("rejects non-admins", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    await expect(
      alice.query(api.users.queries.listAll, { paginationOpts: FIRST_PAGE, search: "a" }),
    ).rejects.toThrow("Admin only");
  });
});

describe("backfillSearchText", () => {
  it("fills missing rows and is idempotent", async () => {
    const t = makeT();
    await signIn(t, "alice");
    const id = await idOf(t, "alice@example.com");
    await t.run((ctx) => ctx.db.patch(id, { searchText: undefined }));
    expect(await t.mutation(internal.users.internal.backfillSearchText, {})).toEqual({ filled: 1 });
    expect((await t.run((ctx) => ctx.db.get(id)))!.searchText).toBe("alice smith alice@example.com");
    expect(await t.mutation(internal.users.internal.backfillSearchText, {})).toEqual({ filled: 0 });
  });
});

describe("clerk webhook", () => {
  const send = async (t: T, payload: unknown, opts: { ts?: number; tamper?: boolean; unsigned?: boolean } = {}) => {
    const body = JSON.stringify(payload);
    const ts = String(Math.floor((opts.ts ?? Date.now()) / 1000));
    const sig = await svixSignature(WH_SECRET, "msg_1", ts, body);
    const headers: Record<string, string> = opts.unsigned
      ? {}
      : { "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": `v1,${sig}` };
    return t.fetch("/clerk/webhook", { method: "POST", headers, body: opts.tamper ? body + " " : body });
  };
  const clerkUser = (over: Record<string, unknown> = {}) => ({
    id: "user_new",
    first_name: "Nia",
    last_name: "Park",
    primary_email_address_id: "idn_2",
    email_addresses: [
      { id: "idn_1", email_address: "other@example.com" },
      { id: "idn_2", email_address: "Nia@Example.com" },
    ],
    ...over,
  });

  it("503 when the secret is unset", async () => {
    const t = makeT();
    expect((await send(t, { type: "user.created", data: clerkUser() })).status).toBe(503);
  });

  it("401 for unsigned, stale and tampered requests", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", WH_SECRET);
    const t = makeT();
    const evt = { type: "user.created", data: clerkUser() };
    expect((await send(t, evt, { unsigned: true })).status).toBe(401);
    expect((await send(t, evt, { ts: Date.now() - 10 * 60_000 })).status).toBe(401);
    expect((await send(t, evt, { tamper: true })).status).toBe(401);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  it("400 on bad JSON", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", WH_SECRET);
    const t = makeT();
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "not json";
    const sig = await svixSignature(WH_SECRET, "msg_1", ts, body);
    const res = await t.fetch("/clerk/webhook", {
      method: "POST",
      headers: { "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": `v1,${sig}` },
      body,
    });
    expect(res.status).toBe(400);
  });

  it("created and updated upsert by clerkId, ignored events return 200", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", WH_SECRET);
    const t = makeT();
    expect((await send(t, { type: "user.created", data: clerkUser() })).status).toBe(200);
    expect((await send(t, { type: "user.created", data: clerkUser() })).status).toBe(200);
    let rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clerkId: "user_new", name: "Nia Park", email: "Nia@Example.com", role: "user", searchText: "nia park nia@example.com" });
    await send(t, { type: "user.updated", data: clerkUser({ first_name: "Nina" }) });
    rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Nina Park");
    expect((await send(t, { type: "session.created", data: {} })).status).toBe(200);
  });

  it("config email is admin on create; updated never demotes", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", WH_SECRET);
    const t = makeT();
    await send(t, { type: "user.created", data: clerkUser({ id: "user_a", primary_email_address_id: "x", email_addresses: [{ id: "x", email_address: "admin@example.com" }] }) });
    await send(t, { type: "user.created", data: clerkUser() });
    const nia = await idOf(t, "Nia@Example.com");
    await t.run((ctx) => ctx.db.patch(nia, { role: "admin" }));
    await send(t, { type: "user.updated", data: clerkUser() });
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows.find((u) => u.clerkId === "user_a")!.role).toBe("admin");
    expect(rows.find((u) => u.clerkId === "user_new")!.role).toBe("admin");
  });

  it("deleted marks the user, removes tools, declines pending with an event, keeps approved loans; replays are no-ops", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", WH_SECRET);
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const toolA = await bob.mutation(api.tools.mutations.create, { name: "Drill", category: "power_tools", condition: "good", description: "d" });
    const toolB = await bob.mutation(api.tools.mutations.create, { name: "Saw", category: "power_tools", condition: "good", description: "d" });
    const pending = await alice.mutation(api.loans.mutations.request, { toolId: toolA, startDate: addDays(1), endDate: addDays(2) });
    const approved = await alice.mutation(api.loans.mutations.request, { toolId: toolB, startDate: addDays(1), endDate: addDays(2) });
    await bob.mutation(api.loans.mutations.approve, { loanId: approved });
    const bobId = await idOf(t, "bob@example.com");

    const evt = { type: "user.deleted", data: { id: "clerk_bob", deleted: true } };
    expect((await send(t, evt)).status).toBe(200);
    expect((await send(t, evt)).status).toBe(200);

    const bobRow = (await t.run((ctx) => ctx.db.get(bobId)))!;
    expect(bobRow.name).toBe("Deleted user");
    expect(bobRow.deletedAt).toBeTypeOf("number");
    expect(bobRow.searchText).toBe("deleted user bob@example.com");
    expect(await t.run((ctx) => ctx.db.query("tools").collect())).toHaveLength(0);
    const loans = await t.run((ctx) => ctx.db.query("loans").collect());
    expect(loans.find((l) => l._id === pending)!.status).toBe("declined");
    expect(loans.find((l) => l._id === approved)!.status).toBe("approved");
    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events.filter((e) => e.loanId === pending && e.type === "loan.declined")).toHaveLength(1);
    // unknown user: still 200
    expect((await send(t, { type: "user.deleted", data: { id: "nobody" } })).status).toBe(200);
  });
});

describe("clerk actions", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const clerkRow = (id: string, email: string, first: string, last = "") => ({
    id,
    first_name: first,
    last_name: last,
    primary_email_address_id: "e",
    email_addresses: [{ id: "e", email_address: email }],
  });

  it("updateName patches Clerk and the local row", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal("fetch", fetchMock);
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "alice");
    const aliceId = await idOf(t, "alice@example.com");
    await admin.action(api.users.actions.updateName, { userId: aliceId, firstName: "  Alicia ", lastName: "Stone" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.clerk.com/v1/users/clerk_alice");
    expect(init.method).toBe("PATCH");
    expect(init.headers.authorization).toBe("Bearer sk_test_x");
    expect(JSON.parse(init.body)).toEqual({ first_name: "Alicia", last_name: "Stone" });
    const row = (await t.run((ctx) => ctx.db.get(aliceId)))!;
    expect(row.name).toBe("Alicia Stone");
    expect(row.searchText).toBe("alicia stone alice@example.com");
  });

  it("updateName validates, refuses demo/deleted, and surfaces config and Clerk errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("secret body", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "alice");
    const aliceId = await idOf(t, "alice@example.com");
    const run = (args: { firstName: string; lastName: string; userId?: Id<"users"> }) =>
      admin.action(api.users.actions.updateName, { userId: aliceId, ...args });

    await expect(run({ firstName: "A", lastName: "B" })).rejects.toThrow("Name editing isn't configured on this server");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    await expect(run({ firstName: "   ", lastName: "" })).rejects.toThrow("First name must be 1-50 characters");
    await expect(run({ firstName: "x".repeat(51), lastName: "" })).rejects.toThrow("First name must be 1-50");
    await expect(run({ firstName: "A", lastName: "y".repeat(51) })).rejects.toThrow("Last name must be at most 50");
    expect(fetchMock).not.toHaveBeenCalled();

    const err = await run({ firstName: "A", lastName: "" }).catch((e: Error) => e);
    expect((err as Error).message).toContain("Clerk rejected the change (422)");
    expect((err as Error).message).not.toContain("secret body");
    expect((await t.run((ctx) => ctx.db.get(aliceId)))!.name).toBe("Alice Smith");

    await t.mutation(internal.seed.demo, {});
    const demoId = (await t.run((ctx) => ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "seed:demo")).unique()))!._id;
    await expect(run({ userId: demoId, firstName: "A", lastName: "" })).rejects.toThrow("The demo account can't be renamed");
    await t.run((ctx) => ctx.db.patch(aliceId, { deletedAt: Date.now() }));
    await expect(run({ firstName: "A", lastName: "" })).rejects.toThrow("This account was deleted");
  });

  it("syncFromClerk pages through users and upserts", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    const page1 = Array.from({ length: 100 }, (_, i) => clerkRow(`user_${i}`, `u${i}@example.com`, `U${i}`));
    const page2 = [clerkRow("clerk_alice", "alice@example.com", "Alicia", "S"), { id: "no_email", email_addresses: [] }];
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(page1)).mockResolvedValueOnce(ok(page2));
    vi.stubGlobal("fetch", fetchMock);
    const t = makeT();
    const admin = await signIn(t, "admin");
    await signIn(t, "alice");
    const res = await admin.action(api.users.actions.syncFromClerk, {});
    expect(res).toEqual({ created: 100, updated: 1 });
    expect(fetchMock.mock.calls[0][0]).toContain("/users?limit=100&offset=0");
    expect(fetchMock.mock.calls[1][0]).toContain("offset=100");
    const aliceId = await idOf(t, "alice@example.com");
    const alice = (await t.run((ctx) => ctx.db.get(aliceId)))!;
    expect(alice.name).toBe("Alicia S");
  });

  it("syncFromClerk surfaces missing key and non-2xx", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    await expect(admin.action(api.users.actions.syncFromClerk, {})).rejects.toThrow(
      "Name editing isn't configured on this server",
    );
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(admin.action(api.users.actions.syncFromClerk, {})).rejects.toThrow(
      "Clerk rejected the change (500)",
    );
  });

  it("actions reject non-admins and signed-out callers", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = makeT();
    const alice = await signIn(t, "alice");
    const aliceId = await idOf(t, "alice@example.com");
    await expect(alice.action(api.users.actions.syncFromClerk, {})).rejects.toThrow("Admin only");
    await expect(
      alice.action(api.users.actions.updateName, { userId: aliceId, firstName: "A", lastName: "" }),
    ).rejects.toThrow("Admin only");
    await expect(t.action(api.users.actions.syncFromClerk, {})).rejects.toThrow("Not signed in");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
