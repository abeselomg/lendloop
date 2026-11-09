// Pure TypeScript: no Convex or Node imports. Shared by backend and UI.
export const CATEGORY_ICONS = ["power_tools","hand_tools","garden","kitchen","camping","cleaning","automotive","other"] as const;
export const DEFAULT_CATEGORIES = [
  { slug: "power_tools", label: "Power tools", icon: "power_tools", order: 10 },
  { slug: "hand_tools", label: "Hand tools", icon: "hand_tools", order: 20 },
  { slug: "garden", label: "Garden", icon: "garden", order: 30 },
  { slug: "kitchen", label: "Kitchen", icon: "kitchen", order: 40 },
  { slug: "camping", label: "Camping", icon: "camping", order: 50 },
  { slug: "cleaning", label: "Cleaning", icon: "cleaning", order: 60 },
  { slug: "automotive", label: "Automotive", icon: "automotive", order: 70 },
  { slug: "other", label: "Other", icon: "other", order: 80 },
] as const;
export const CONDITIONS = ["new","good","fair","worn"] as const;
export const LOAN_STATUSES = ["pending","approved","declined","returned","cancelled"] as const;
export const EVENT_TYPES = ["loan.requested","loan.approved","loan.declined","loan.returned","loan.cancelled"] as const;
export const EVENT_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
  "loan.requested": "Request",
  "loan.approved": "Approval",
  "loan.declined": "Decline",
  "loan.returned": "Return",
  "loan.cancelled": "Cancellation",
};
// First word of the name; otherwise the email's local part without a "+tag" (never the full email).
export function displayFirstName(user: { name?: string; email: string }): string {
  const first = user.name?.trim().split(/\s+/)[0];
  if (first) return first;
  const local = user.email.split("@")[0];
  return local.split("+")[0] || local;
}
export const LOG_KINDS =["webhook_delivered","webhook_failed","notification_sent","notification_failed","reminder_sent","workflow_error"] as const;

/** A category slug (categories are admin-managed data). */
export type Category = string;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type LogKind = (typeof LOG_KINDS)[number];

export const MAX_LOAN_DAYS = 30;

const DAY_MS = 86_400_000;

export function todayUtc(now?: number): string {
  const d = new Date(now ?? Date.now());
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isIsoDate(s: string): boolean {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtcMs(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** b - a in whole days. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** Inclusive on both ends; ISO date strings compare lexicographically. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function validateDateRange(startDate: string, endDate: string, today: string): string | null {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return "Dates must be in YYYY-MM-DD format";
  if (startDate < today) return "Start date can't be in the past";
  if (endDate < startDate) return "End date can't be before the start date";
  if (daysBetween(startDate, endDate) > MAX_LOAN_DAYS) return `Loans are limited to ${MAX_LOAN_DAYS} days`;
  return null;
}

export function validateToolInput(input: {
  name: string;
  category: string;
  condition: string;
  description: string;
}): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) return "Name must be 2–60 characters";
  // Whether the slug exists and is active is checked against the categories table in the mutation.
  if (!input.category.trim()) return "Choose a valid category";
  if (!(CONDITIONS as readonly string[]).includes(input.condition)) return "Choose a valid condition";
  if (input.description.length > 300) return "Description must be 300 characters or fewer";
  return null;
}

export function slugifyCategory(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function validateCategoryLabel(label: string): string | null {
  const l = label.trim();
  if (l.length < 2 || l.length > 30) return "Name must be 2–30 characters";
  if (!slugifyCategory(l)) return "Name must include letters or numbers";
  return null;
}

export function isCategoryIcon(icon: string): boolean {
  return (CATEGORY_ICONS as readonly string[]).includes(icon);
}
