"use client";

import { DayPicker, type Matcher } from "react-day-picker";
import "react-day-picker/style.css";
import { MAX_LOAN_DAYS, daysBetween } from "@convex/lib/validation";
import { dateToIso, isoToDate, nextSelection, type DateSelection } from "@/lib/dateSelection";

const addDays = (date: Date, n: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const dayLabel = (iso: string) =>
  isoToDate(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

function summary({ start, end }: DateSelection): string {
  if (!start) return "Pick the day you'd collect it.";
  if (!end) return `From ${dayLabel(start)}. Now pick the return day (the same day for a one-day loan).`;
  const days = daysBetween(start, end) + 1;
  const span = start === end ? dayLabel(start) : `${dayLabel(start)} to ${dayLabel(end)}`;
  return `${span}, ${days} ${days === 1 ? "day" : "days"}.`;
}

export function DateRangePicker({
  today,
  booked,
  value,
  onChange,
}: {
  today: string;
  booked: { startDate: string; endDate: string }[] | undefined;
  value: DateSelection;
  onChange: (next: DateSelection) => void;
}) {
  const first = isoToDate(today);
  const bookedMatchers: Matcher[] = (booked ?? []).map((b) => ({ from: isoToDate(b.startDate), to: isoToDate(b.endDate) }));
  const disabled: Matcher[] = [{ before: first }, ...bookedMatchers];
  // While the start is picked and the end is not, days past the loan limit can't be the end.
  if (value.start && !value.end) disabled.push({ after: addDays(isoToDate(value.start), MAX_LOAN_DAYS) });

  return (
    <div className="lendloop-rdp rounded-xl border border-line bg-bg px-2 py-1">
      <DayPicker
        mode="range"
        selected={value.start ? { from: isoToDate(value.start), to: value.end ? isoToDate(value.end) : undefined } : undefined}
        onSelect={(_range, day) => onChange(nextSelection(value, dateToIso(day), booked ?? []))}
        disabled={disabled}
        modifiers={{ booked: bookedMatchers }}
        modifiersClassNames={{ booked: "rdp-booked" }}
        startMonth={first}
        endMonth={addDays(first, 365)}
        defaultMonth={value.start ? isoToDate(value.start) : first}
        showOutsideDays
        footer={
          <p className="px-1 pb-1 pt-2 text-sm text-ink">
            {summary(value)}
          </p>
        }
      />
      {bookedMatchers.length > 0 ? (
        <p className="px-1 pb-2 text-xs text-muted">Crossed-out days are already booked.</p>
      ) : null}
    </div>
  );
}
