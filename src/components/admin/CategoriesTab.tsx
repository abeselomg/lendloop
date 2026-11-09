"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CategoryIcon } from "@/components/CategoryIcon";
import { RowsSkeleton } from "@/components/Skeleton";
import { useCategories, type CategoryRow } from "@/lib/hooks/useCategories";
import { IconPicker } from "./IconPicker";
import { BTN, BTN_PRIMARY, ConfirmButton, Empty, INPUT, InlineError, RowList, useAction } from "./shared";

const asId = (row: CategoryRow) => row._id as Id<"categories">;

function AddCategory() {
  const create = useMutation(api.categories.mutations.create);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("other");
  const { busy, error, run } = useAction();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (await run(() => create({ label: label.trim(), icon }))) {
      setLabel("");
      setIcon("other");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold tracking-tight">Add a category</h2>
      <div>
        <label htmlFor="new-category-label" className="mb-1.5 block text-sm text-muted">
          Name
        </label>
        <input
          id="new-category-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={30}
          autoComplete="off"
          className={`${INPUT} w-full max-w-xs`}
        />
      </div>
      <IconPicker legend="Icon" value={icon} onChange={setIcon} disabled={busy} />
      <InlineError>{error}</InlineError>
      <button type="submit" disabled={busy || label.trim().length < 2} className={BTN_PRIMARY}>
        {busy ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}

function EditForm({ row, onDone }: { row: CategoryRow; onDone: () => void }) {
  const update = useMutation(api.categories.mutations.update);
  const [label, setLabel] = useState(row.label);
  const [icon, setIcon] = useState(row.icon);
  const { busy, error, run } = useAction();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      update({
        id: asId(row),
        ...(label.trim() !== row.label ? { label: label.trim() } : {}),
        ...(icon !== row.icon ? { icon } : {}),
      }),
    );
    if (ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-3">
      <div>
        <label htmlFor={`edit-${row._id}`} className="mb-1.5 block text-sm text-muted">
          Name
        </label>
        <input
          id={`edit-${row._id}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={30}
          autoComplete="off"
          className={`${INPUT} w-full max-w-xs`}
        />
      </div>
      <IconPicker legend="Icon" value={icon} onChange={setIcon} disabled={busy} />
      <InlineError>{error}</InlineError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || label.trim().length < 2} className={BTN_PRIMARY}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" disabled={busy} onClick={onDone} className={BTN}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Row({
  row,
  index,
  all,
}: {
  row: CategoryRow;
  index: number;
  all: CategoryRow[];
}) {
  const update = useMutation(api.categories.mutations.update);
  const setActive = useMutation(api.categories.mutations.setActive);
  const remove = useMutation(api.categories.mutations.remove);
  const [editing, setEditing] = useState(false);
  const { busy, error, run } = useAction();

  // Swap `order` with the neighbour; the list is already sorted by order.
  const move = (other: CategoryRow) =>
    run(async () => {
      await update({ id: asId(row), order: other.order });
      await update({ id: asId(other), order: row.order });
    });
  const prev = all[index - 1];
  const next = all[index + 1];

  return (
    <li className="px-4 py-3">
      {editing ? (
        <EditForm row={row} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <CategoryIcon icon={row.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {row.label}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.active
                      ? "bg-accent-soft text-accent"
                      : "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
                  }`}
                >
                  {row.active ? "Active" : "Archived"}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-muted">
                <code className="text-xs">{row.slug}</code> · {row.toolCount} {row.toolCount === 1 ? "tool" : "tools"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !prev}
              onClick={() => prev && move(prev)}
              aria-label={`Move ${row.label} up`}
              className={BTN}
            >
              Up
            </button>
            <button
              type="button"
              disabled={busy || !next}
              onClick={() => next && move(next)}
              aria-label={`Move ${row.label} down`}
              className={BTN}
            >
              Down
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(true)} aria-label={`Edit ${row.label}`} className={BTN}>
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => setActive({ id: asId(row), active: !row.active }))}
              aria-label={`${row.active ? "Archive" : "Restore"} ${row.label}`}
              className={BTN}
            >
              {row.active ? "Archive" : "Restore"}
            </button>
            {row.toolCount === 0 ? (
              <ConfirmButton
                label="Delete"
                pendingLabel="Deleting…"
                ariaLabel={`Delete ${row.label}`}
                question="Delete this category?"
                confirmLabel="Yes, delete"
                disabled={busy}
                onConfirm={() => remove({ id: asId(row) })}
              />
            ) : (
              <button
                type="button"
                disabled
                aria-label={`Delete ${row.label} (unavailable)`}
                title={`Archive it instead — ${row.toolCount} ${row.toolCount === 1 ? "tool uses" : "tools use"} it`}
                className={BTN}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
      {!editing && row.toolCount > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Can&apos;t delete: archive it instead — {row.toolCount} {row.toolCount === 1 ? "tool uses" : "tools use"} it.
        </p>
      ) : null}
      <div className="mt-2">
        <InlineError>{error}</InlineError>
      </div>
    </li>
  );
}

export function CategoriesTab() {
  const { all, isLoading } = useCategories();

  return (
    <div>
      <p className="mb-5 max-w-prose text-sm text-muted">
        Archived categories are hidden from new listings and filters. Tools that already use them keep them.
      </p>
      <AddCategory />
      {isLoading ? (
        <RowsSkeleton label="Loading categories" />
      ) : all.length === 0 ? (
        <Empty>No categories yet. Add the first one above.</Empty>
      ) : (
        <RowList label="Categories">
          {all.map((row, i) => (
            <Row key={row._id} row={row} index={i} all={all} />
          ))}
        </RowList>
      )}
    </div>
  );
}
