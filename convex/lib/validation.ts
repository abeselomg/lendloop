// Pure TypeScript: no Convex or Node imports. Shared by backend and UI.
export const CATEGORIES = ["power_tools","hand_tools","garden","kitchen","camping","cleaning","automotive","other"] as const;
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
export const LOG_KINDS = ["webhook_delivered","webhook_failed","notification_sent","notification_failed","reminder_sent","workflow_error"] as const;

export type Category = (typeof CATEGORIES)[number];
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
  if (!(CATEGORIES as readonly string[]).includes(input.category)) return "Choose a valid category";
  if (!(CONDITIONS as readonly string[]).includes(input.condition)) return "Choose a valid condition";
  if (input.description.length > 300) return "Description must be 300 characters or fewer";
  return null;
}
