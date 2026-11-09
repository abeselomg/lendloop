"use client";

import { useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import "react-day-picker/style.css";
import { daysBetween } from "@convex/lib/validation";
import { dateToIso, isoToDate, nextSelection, previewEnd, type DateSelection } from "@/lib/dateSelection";

const dayLabel = (iso: string) =>
  isoToDate(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

function summary({ start, end }: DateSelection, preview: string | null): string {
  if (!start) return "Pick the day you'd collect it.";
  if (!end && preview) return `${span(start, preview)}. Click to make it the return day.`;
  if (!end) return `From ${dayLabel(start)}. Now pick the return day (the same day for a one-day loan).`;
  return `${span(start, end)}.`;
}

function span(start: string, end: string): string {
  const days = daysBetween(start, end) + 1;
  const range = start === end ? dayLabel(start) : `${dayLabel(start)} to ${dayLabel(end)}`;
  return `${range}, ${days} ${days === 1 ? "day" : "days"}`;
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
  // The day under the pointer or keyboard focus, used to preview the range before the return day is clicked.
  const [hovered, setHovered] = useState<string | null>(null);
  const preview = previewEnd(value, hovered, booked ?? []);
  const first = isoToDate(today);
  const bookedMatchers: Matcher[] = (booked ?? []).map((b) => ({ from: isoToDate(b.startDate), to: isoToDate(b.endDate) }));
  const disabled: Matcher[] = [{ before: first }, ...bookedMatchers];

  return (
    <div className="lendloop-rdp rounded-xl border border-line bg-bg px-2 py-1">
      <DayPicker
        mode="range"
        selected={value.start ? { from: isoToDate(value.start), to: value.end ? isoToDate(value.end) : undefined } : undefined}
        onSelect={(_range, day) => onChange(nextSelection(value, dateToIso(day), booked ?? []))}
        disabled={disabled}
        modifiers={{
          booked: bookedMatchers,
          pickedStart: value.start && !value.end ? isoToDate(value.start) : [],
          preview: value.start && preview ? { from: isoToDate(value.start), to: isoToDate(preview) } : [],
          previewEnd: preview ? isoToDate(preview) : [],
        }}
        modifiersClassNames={{
          booked: "rdp-booked",
          pickedStart: "rdp-picked-start",
          preview: "rdp-preview",
          previewEnd: "rdp-preview-end",
        }}
        onDayMouseEnter={(day) => setHovered(dateToIso(day))}
        onDayMouseLeave={() => setHovered(null)}
        onDayFocus={(day) => setHovered(dateToIso(day))}
        onDayBlur={() => setHovered(null)}
        startMonth={first}
        defaultMonth={value.start ? isoToDate(value.start) : first}
        showOutsideDays
        footer={
          <p className="px-1 pb-1 pt-2 text-sm text-ink">
            {summary(value, preview)}
          </p>
        }
      />
      {bookedMatchers.length > 0 ? (
        <p className="px-1 pb-2 text-xs text-muted">Crossed-out days are already booked.</p>
      ) : null}
    </div>
  );
}
