import { v } from "convex/values";

/** A Clerk user reduced to what LendLoop stores. */
export const clerkUserValidator = v.object({
  clerkId: v.string(),
  email: v.string(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
});
export type ClerkUserInput = {
  clerkId: string;
  email: string;
  name: string;
  imageUrl?: string;
};

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");

/** Map a Clerk Backend API / webhook user object; null when it has no id or primary email. */
export function parseClerkUser(raw: unknown): ClerkUserInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const u = raw as Record<string, unknown>;
  const clerkId = str(u.id);
  if (!clerkId) return null;
  const emails = Array.isArray(u.email_addresses) ? (u.email_addresses as Record<string, unknown>[]) : [];
  const primary = emails.find((e) => e && e.id === u.primary_email_address_id) ?? emails[0];
  const email = str(primary?.email_address);
  if (!email) return null;
  const name = [str(u.first_name), str(u.last_name)].filter(Boolean).join(" ") || str(u.username);
  const imageUrl = str(u.image_url) || undefined;
  return { clerkId, email, name, imageUrl };
}
