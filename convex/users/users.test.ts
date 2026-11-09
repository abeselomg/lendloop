import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import { FIRST_PAGE, identities, makeT, signIn } from "../test.setup";

describe("users", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ensure creates a user once and is idempotent", async () => {
    const t = makeT();
    const alice = t.withIdentity(identities.alice);
    const a = await alice.mutation(api.users.mutations.ensure, {});
    const b = await alice.mutation(api.users.mutations.ensure, {});
    expect(b.userId).toEqual(a.userId);
    expect(a.role).toBe("user");
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].trustedLender).toBe(false);
  });

  it("ensure grants admin from ADMIN_EMAILS, case-insensitive", async () => {
    const t = makeT();
    const u = t.withIdentity({ ...identities.admin, email: "Admin@Example.com" });
    const r = await u.mutation(api.users.mutations.ensure, {});
    expect(r.role).toBe("admin");
  });

  it("ensure promotes an existing user but never demotes", async () => {
    const t = makeT();
    const id = { ...identities.alice, subject: "clerk_x", email: "x@example.com" };
    await t.withIdentity(id).mutation(api.users.mutations.ensure, {});
    vi.stubEnv("ADMIN_EMAILS", "x@example.com");
    expect((await t.withIdentity(id).mutation(api.users.mutations.ensure, {})).role).toBe("admin");
    vi.stubEnv("ADMIN_EMAILS", "");
    expect((await t.withIdentity(id).mutation(api.users.mutations.ensure, {})).role).toBe("admin");
  });

  it("ensure requires an email on the token", async () => {
    const t = makeT();
    await expect(
      t.withIdentity({ subject: "clerk_noemail" }).mutation(api.users.mutations.ensure, {}),
    ).rejects.toThrow("Your account has no email on its Clerk token");
  });

  it("me returns null when signed out or not yet initialized", async () => {
    const t = makeT();
    expect(await t.query(api.users.queries.me, {})).toBeNull();
    expect(await t.withIdentity(identities.alice).query(api.users.queries.me, {})).toBeNull();
    const alice = await signIn(t, "alice");
    const me = await alice.query(api.users.queries.me, {});
    expect(me).toMatchObject({ name: "Alice Smith", firstName: "Alice", email: "alice@example.com", role: "user", trustedLender: false });
  });

  it("setTrustedLender rejects non-admin", async () => {
    const t = makeT();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const bobMe = await bob.query(api.users.queries.me, {});
    await expect(
      alice.mutation(api.users.mutations.setTrustedLender, { userId: bobMe!._id, trusted: true }),
    ).rejects.toThrow("Admin only");
    await expect(alice.query(api.users.queries.listAll, { paginationOpts: FIRST_PAGE })).rejects.toThrow("Admin only");
  });

  it("setTrustedLender works for admin and listAll shows it", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    const bob = await signIn(t, "bob");
    const bobMe = await bob.query(api.users.queries.me, {});
    await admin.mutation(api.users.mutations.setTrustedLender, { userId: bobMe!._id, trusted: true });
    const all = (await admin.query(api.users.queries.listAll, { paginationOpts: FIRST_PAGE })).page;
    expect(all).toHaveLength(2);
    expect(all.find((u) => u.email === "bob@example.com")?.trustedLender).toBe(true);
  });

  it("setTrustedLender on unknown user throws", async () => {
    const t = makeT();
    const admin = await signIn(t, "admin");
    const bob = await signIn(t, "bob");
    const bobMe = await bob.query(api.users.queries.me, {});
    await t.run((ctx) => ctx.db.delete(bobMe!._id));
    await expect(
      admin.mutation(api.users.mutations.setTrustedLender, { userId: bobMe!._id, trusted: true }),
    ).rejects.toThrow("User not found");
  });
});
