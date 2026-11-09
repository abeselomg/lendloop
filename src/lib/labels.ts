import type { Condition, LoanStatus } from "@convex/lib/validation";

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export const STATUS_LABELS: Record<LoanStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  returned: "Returned",
  cancelled: "Cancelled",
};

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, "day");
  return plural(Math.floor(days / 7), "week");
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return { y, m, d, month };
}

export function formatDateRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.y !== b.y) {
    return `${a.d} ${a.month} ${a.y} – ${b.d} ${b.month} ${b.y}`;
  }
  if (a.m !== b.m) {
    return `${a.d} ${a.month} – ${b.d} ${b.month} ${b.y}`;
  }
  if (a.d === b.d) return `${a.d} ${a.month} ${a.y}`;
  return `${a.d}–${b.d} ${a.month} ${a.y}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue 1 Dec 2026" for a calendar day ("YYYY-MM-DD"). Built by hand so server and browser render the same text. */
export function formatDay(iso: string): string {
  const { y, m, d, month } = parts(iso);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${month} ${y}`;
}
