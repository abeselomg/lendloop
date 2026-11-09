import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { makeT, signIn } from "./test.setup";
import { todayUtc } from "./lib/validation";

const base = { name: "Cordless Drill", category: "power_tools" as const, condition: "good" as const, description: "18V" };

const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const t = makeT();
  const alice = await signIn(t, "alice"); // borrower
  const bob = await signIn(t, "bob"); // lender / owner
  const toolId = await bob.mutation(api.tools.create, base);
  return { t, alice, bob, toolId };
}
const events = (t: ReturnType<typeof makeT>) => t.run((ctx) => ctx.db.query("automationEvents").collect());
const userId = (t: ReturnType<typeof makeT>, subject: string) =>
  t.run(async (ctx) => (await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", subject)).unique())!._id);

describe("loans", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("request creates pending loan and a loan.requested event for the lender", async () => {
    const { t, alice, toolId } = await setup();
    const loanId = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(3), note: "  hi  " });
    const loan = await t.run((ctx) => ctx.db.get(loanId));
    expect(loan?.status).toBe("pending");
    expect(loan?.note).toBe("hi");
    expect(loan?.toolName).toBe("Cordless Drill");
    const ev = await events(t);
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe("loan.requested");
    expect(ev[0].status).toBe("pending");
    expect(ev[0].attempts).toBe(0);
    expect(ev[0].recipientUserId).toBe(await userId(t, "clerk_bob"));
    await expect(
      alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2), note: "x".repeat(301) }),
    ).rejects.toThrow("Note is too long");
    await expect(alice.mutation(api.loans.request, { toolId, startDate: "2000-01-01", endDate: addDays(2) })).rejects.toThrow(
      "Start date can't be in the past",
    );
  });

  it("approve rejects a pending loan whose dates have passed", async () => {
    const { t, bob, toolId } = await setup();
    const alice = await userId(t, "clerk_alice");
    const bobId = await userId(t, "clerk_bob");
    const loanId = await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        toolName: "Cordless Drill",
        borrowerId: alice,
        lenderId: bobId,
        startDate: addDays(-5),
        endDate: addDays(-2),
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reminderCount: 0,
      } as never),
    );
    await expect(bob.mutation(api.loans.approve, { loanId })).rejects.toThrow("Those dates have passed");
  });

  it("cannot request own tool", async () => {
    const { bob, toolId } = await setup();
    await expect(bob.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) })).rejects.toThrow(
      "You can't borrow your own tool",
    );
  });

  it("approve by borrower rejected; by lender sets approved + event to borrower", async () => {
    const { t, alice, bob, toolId } = await setup();
    const loanId = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(3) });
    await expect(alice.mutation(api.loans.approve, { loanId })).rejects.toThrow("Only the lender can do that");
    await bob.mutation(api.loans.approve, { loanId });
    expect((await t.run((ctx) => ctx.db.get(loanId)))?.status).toBe("approved");
    const ev = (await events(t)).filter((e) => e.type === "loan.approved");
    expect(ev).toHaveLength(1);
    expect(ev[0].recipientUserId).toBe(await userId(t, "clerk_alice"));
    await expect(bob.mutation(api.loans.approve, { loanId })).rejects.toThrow("Request is not pending");
  });

  it("approve rejects overlapping approved loan on same tool", async () => {
    const { alice, bob, toolId } = await setup();
    const a = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(5) });
    const b = await alice.mutation(api.loans.request, { toolId, startDate: addDays(5), endDate: addDays(8) });
    const c = await alice.mutation(api.loans.request, { toolId, startDate: addDays(6), endDate: addDays(8) });
    await bob.mutation(api.loans.approve, { loanId: a });
    await expect(bob.mutation(api.loans.approve, { loanId: b })).rejects.toThrow("Tool is already lent out for those dates");
    await bob.mutation(api.loans.approve, { loanId: c });
  });

  it("request rejects dates that overlap an approved loan", async () => {
    const { alice, bob, toolId } = await setup();
    const a = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(5) });
    await bob.mutation(api.loans.approve, { loanId: a });
    await expect(
      alice.mutation(api.loans.request, { toolId, startDate: addDays(5), endDate: addDays(7) }),
    ).rejects.toThrow("Those dates are already booked");
    await alice.mutation(api.loans.request, { toolId, startDate: addDays(6), endDate: addDays(8) });
  });

  it("bookedRanges lists only approved loans that have not ended, with dates only", async () => {
    const { t, alice, bob, toolId } = await setup();
    const a = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(5) });
    await bob.mutation(api.loans.approve, { loanId: a });
    await alice.mutation(api.loans.request, { toolId, startDate: addDays(10), endDate: addDays(12) }); // pending
    const r = await alice.mutation(api.loans.request, { toolId, startDate: addDays(20), endDate: addDays(21) });
    await bob.mutation(api.loans.approve, { loanId: r });
    await bob.mutation(api.loans.markReturned, { loanId: r }); // returned
    const aliceId = await userId(t, "clerk_alice");
    const bobId = await userId(t, "clerk_bob");
    await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId, toolName: "Cordless Drill", borrowerId: aliceId, lenderId: bobId,
        startDate: addDays(-6), endDate: addDays(-2), status: "approved",
        createdAt: Date.now(), updatedAt: Date.now(), reminderCount: 0,
      }),
    ); // approved but already ended
    expect(await alice.query(api.loans.bookedRanges, { toolId })).toEqual([{ startDate: addDays(1), endDate: addDays(5) }]);
    await expect(t.query(api.loans.bookedRanges, { toolId })).rejects.toThrow("Not signed in");
  });

  it("decline/markReturned enforce status transitions", async () => {
    const { t, alice, bob, toolId } = await setup();
    const a = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    await expect(bob.mutation(api.loans.markReturned, { loanId: a })).rejects.toThrow();
    await expect(alice.mutation(api.loans.decline, { loanId: a })).rejects.toThrow("Only the lender can do that");
    await bob.mutation(api.loans.approve, { loanId: a });
    await expect(bob.mutation(api.loans.decline, { loanId: a })).rejects.toThrow("Request is not pending");
    await bob.mutation(api.loans.markReturned, { loanId: a });
    const loan = await t.run((ctx) => ctx.db.get(a));
    expect(loan?.status).toBe("returned");
    expect(loan?.returnedAt).toBeTypeOf("number");
    const b = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    await bob.mutation(api.loans.decline, { loanId: b });
    expect((await t.run((ctx) => ctx.db.get(b)))?.status).toBe("declined");
    const types = (await events(t)).map((e) => e.type);
    expect(types).toContain("loan.returned");
    expect(types).toContain("loan.declined");
  });

  it("cancel allowed while pending; approved loan starting today cannot be cancelled", async () => {
    const { t, alice, bob, toolId } = await setup();
    const a = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    await expect(bob.mutation(api.loans.cancel, { loanId: a })).rejects.toThrow("Only the borrower can do that");
    await alice.mutation(api.loans.cancel, { loanId: a });
    expect((await t.run((ctx) => ctx.db.get(a)))?.status).toBe("cancelled");
    expect((await events(t)).some((e) => e.type === "loan.cancelled")).toBe(true);

    const today = await alice.mutation(api.loans.request, { toolId, startDate: todayUtc(), endDate: addDays(1) });
    await bob.mutation(api.loans.approve, { loanId: today });
    await expect(alice.mutation(api.loans.cancel, { loanId: today })).rejects.toThrow("This loan can no longer be cancelled");

    const future = await alice.mutation(api.loans.request, { toolId, startDate: addDays(10), endDate: addDays(11) });
    await bob.mutation(api.loans.approve, { loanId: future });
    await alice.mutation(api.loans.cancel, { loanId: future });
  });

  it("removing a tool declines pending requests and loans keep toolName (toolExists false)", async () => {
    const { t, alice, bob, toolId } = await setup();
    const loanId = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    await bob.mutation(api.tools.remove, { toolId });
    expect((await t.run((ctx) => ctx.db.get(loanId)))?.status).toBe("declined");
    expect((await events(t)).some((e) => e.type === "loan.declined")).toBe(true);
    const mine = await alice.query(api.loans.mine, {});
    expect(mine[0].toolName).toBe("Cordless Drill");
    expect(mine[0].toolExists).toBe(false);
    await expect(alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) })).rejects.toThrow(
      "Tool not found",
    );
  });

  it("mine/incoming/all respect roles; non-admin all -> Admin only", async () => {
    const { t, alice, bob, toolId } = await setup();
    const admin = await signIn(t, "admin");
    const a = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    const b = await alice.mutation(api.loans.request, { toolId, startDate: addDays(3), endDate: addDays(4) });
    await bob.mutation(api.loans.approve, { loanId: a });
    const mine = await alice.query(api.loans.mine, {});
    expect(mine.map((l) => l._id)).toEqual([b, a]);
    expect(mine[0].viewerRole).toBe("borrower");
    expect(mine[0].lender.firstName).toBe("Bob");
    expect(await bob.query(api.loans.mine, {})).toHaveLength(0);
    const inc = await bob.query(api.loans.incoming, {});
    expect(inc.map((l) => l._id)).toEqual([b, a]);
    expect(inc[0].viewerRole).toBe("lender");
    expect(await alice.query(api.loans.incoming, {})).toHaveLength(0);
    await expect(alice.query(api.loans.all, {})).rejects.toThrow("Admin only");
    const all = await admin.query(api.loans.all, {});
    expect(all).toHaveLength(2);
    expect(all[0].viewerRole).toBe("admin");
    expect(all[0].activity).toEqual([]);
  });

  it("admin who is neither party cannot approve/decline/markReturned/cancel", async () => {
    const { t, alice, bob, toolId } = await setup();
    const admin = await signIn(t, "admin");
    const pending = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    const approved = await alice.mutation(api.loans.request, { toolId, startDate: addDays(5), endDate: addDays(6) });
    await bob.mutation(api.loans.approve, { loanId: approved });
    const countBefore = (await events(t)).length;
    const status = async (id: typeof pending) => (await t.run((ctx) => ctx.db.get(id)))?.status;
    await expect(admin.mutation(api.loans.approve, { loanId: pending })).rejects.toThrow("Only the lender can do that");
    await expect(admin.mutation(api.loans.decline, { loanId: pending })).rejects.toThrow("Only the lender can do that");
    await expect(admin.mutation(api.loans.markReturned, { loanId: approved })).rejects.toThrow("Only the lender can do that");
    await expect(admin.mutation(api.loans.cancel, { loanId: pending })).rejects.toThrow("Only the borrower can do that");
    await expect(admin.mutation(api.loans.cancel, { loanId: approved })).rejects.toThrow("Only the borrower can do that");
    expect(await status(pending)).toBe("pending");
    expect(await status(approved)).toBe("approved");
    expect((await events(t)).length).toBe(countBefore);
  });

  it("removing a tool with an approved loan keeps it visible, toolExists false, and still returnable", async () => {
    const { alice, bob, toolId } = await setup();
    const loanId = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    await bob.mutation(api.loans.approve, { loanId });
    await bob.mutation(api.tools.remove, { toolId });
    const inc = await bob.query(api.loans.incoming, {});
    const mine = await alice.query(api.loans.mine, {});
    for (const l of [inc[0], mine[0]]) {
      expect(l._id).toBe(loanId);
      expect(l.status).toBe("approved");
      expect(l.toolName).toBe("Cordless Drill");
      expect(l.toolExists).toBe(false);
    }
    await bob.mutation(api.loans.markReturned, { loanId });
    expect((await bob.query(api.loans.incoming, {}))[0].status).toBe("returned");
  });

  it("removing a tool declines every pending request with one event per borrower", async () => {
    const { t, alice, bob, toolId } = await setup();
    const admin = await signIn(t, "admin"); // acts as a plain second borrower
    const l1 = await alice.mutation(api.loans.request, { toolId, startDate: addDays(1), endDate: addDays(2) });
    const l2 = await admin.mutation(api.loans.request, { toolId, startDate: addDays(3), endDate: addDays(4) });
    await bob.mutation(api.tools.remove, { toolId });
    const loans = await t.run((ctx) => Promise.all([ctx.db.get(l1), ctx.db.get(l2)]));
    expect(loans.map((l) => l?.status)).toEqual(["declined", "declined"]);
    const declined = (await events(t)).filter((e) => e.type === "loan.declined");
    expect(declined).toHaveLength(2);
    for (const l of loans) {
      const match = declined.filter((e) => e.loanId === l!._id);
      expect(match).toHaveLength(1);
      expect(match[0].recipientUserId).toBe(l!.borrowerId);
    }
  });
});
