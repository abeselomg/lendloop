"use client";

import { useState, type FormEvent } from "react";
import { ConvexError } from "convex/values";
import {
  CATEGORIES,
  CONDITIONS,
  validateToolInput,
  type Category,
  type Condition,
} from "@convex/lib/validation";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/labels";

export type ToolFormValues = {
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink";

export function ToolForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ToolFormValues;
  submitLabel: string;
  onSubmit: (values: ToolFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? CATEGORIES[0]);
  const [condition, setCondition] = useState<Condition>(
    initial?.condition ?? CONDITIONS[0],
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const values = { name: name.trim(), category, condition, description: description.trim() };
    const invalid = validateToolInput(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Something went wrong",
      );
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-4 rounded-2xl border border-line bg-surface p-6"
    >
      <label className="block text-sm font-medium">
        Name
        <input
          type="text"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className={fieldClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Condition
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className={fieldClass}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        Description
        <textarea
          required
          maxLength={300}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
        />
        <span className="mt-1 block text-right text-xs font-normal text-muted">
          {description.length}/300
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
