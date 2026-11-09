// Pure date helpers for the borrow-request calendar (no React), so they can be unit tested.
import { rangesOverlap } from "../../convex/lib/validation";

export type DateSelection = { start: string | null; end: string | null };

// Loan dates are calendar days ("YYYY-MM-DD"). They map to local-midnight Dates for the picker and back again,
// so no time zone shift can move a day.
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToIso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Two-click range selection: the first click picks the start, the second the end (the same day again means a
 * one-day loan), and the next click starts over. Clicking before the start, or past a booked day, restarts there.
 */
export function nextSelection(
  current: DateSelection,
  clicked: string,
  booked: { startDate: string; endDate: string }[],
): DateSelection {
  const fresh = { start: clicked, end: null };
  if (!current.start || current.end) return fresh;
  if (clicked < current.start) return fresh;
  if (booked.some((b) => rangesOverlap(current.start!, clicked, b.startDate, b.endDate))) return fresh;
  return { start: current.start, end: clicked };
}

/**
 * While only the start is picked, the day the pointer (or keyboard focus) is on would become the return day if it
 * is a valid end: not before the start and without a booked day in between.
 */
export function previewEnd(
  current: DateSelection,
  hovered: string | null,
  booked: { startDate: string; endDate: string }[],
): string | null {
  if (!current.start || current.end || !hovered || hovered < current.start) return null;
  return nextSelection(current, hovered, booked).end === hovered ? hovered : null;
}
