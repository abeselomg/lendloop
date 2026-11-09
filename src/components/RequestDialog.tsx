"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import { todayUtc, validateDateRange } from "@convex/lib/validation";
import type { ToolView } from "@convex/lib/views";
import { DateRangePicker } from "@/components/DateRangePicker";
import type { DateSelection } from "@/lib/dateSelection";

export function RequestDialog({
  tool,
  onClose,
  onSent,
}: {
  tool: ToolView | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (tool) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [tool]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      {tool ? (
        <RequestForm
          key={tool._id}
          tool={tool}
          onClose={onClose}
          onSent={onSent}
        />
      ) : null}
    </dialog>
  );
}

function RequestForm({
  tool,
  onClose,
  onSent,
}: {
  tool: ToolView;
  onClose: () => void;
  onSent?: () => void;
}) {
  const request = useMutation(api.loans.mutations.request);
  const booked = useQuery(api.loans.queries.bookedRanges, { toolId: tool._id });
  const [dates, setDates] = useState<DateSelection>({ start: null, end: null });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dates.start) {
      setError("Pick the days you need it");
      return;
    }
    const startDate = dates.start;
    const endDate = dates.end ?? dates.start; // start picked but no end: a one-day loan
    const invalid = validateDateRange(startDate, endDate, todayUtc());
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await request({
        toolId: tool._id,
        startDate,
        endDate,
        note: note.trim() ? note.trim() : undefined,
      });
      onSent?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ConvexError ? String(err.data) : "Something went wrong",
      );
      setPending(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink";

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Request to borrow</h2>
        {tool ? (
          <p className="mt-1 text-sm text-muted">
            {tool.name}, lent by {tool.owner.firstName}
          </p>
        ) : null}
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Dates</legend>
        <div className="mt-1">
          <DateRangePicker
            today={todayUtc()}
            booked={booked}
            value={dates}
            onChange={(next) => {
              setDates(next);
              setError(null);
            }}
          />
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        Note (optional)
        <textarea
          maxLength={300}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
