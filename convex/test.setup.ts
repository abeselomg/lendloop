/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

export const modules = import.meta.glob("./**/*.ts");

export function makeT() {
  return convexTest(schema, modules);
}

export const identities = {
  alice: { subject: "clerk_alice", email: "alice@example.com", name: "Alice Smith" },
  bob: { subject: "clerk_bob", email: "bob@example.com", name: "Bob Jones" },
  admin: { subject: "clerk_admin", email: "admin@example.com", name: "Ada Admin" },
};

export async function signIn(t: ReturnType<typeof makeT>, who: keyof typeof identities) {
  const u = t.withIdentity(identities[who]);
  await u.mutation(api.users.mutations.ensure, {});
  return u;
}
