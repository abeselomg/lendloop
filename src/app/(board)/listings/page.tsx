"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CONDITION_LABELS } from "@/lib/labels";
import { CategoryBadge } from "@/components/CategoryBadge";
import { EmptyState } from "@/components/EmptyState";

const primaryLink =
  "rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

export default function ListingsPage() {
  const tools = useQuery(api.tools.mine);
  const remove = useMutation(api.tools.remove);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Id<"tools"> | null>(null);

  async function onDelete(toolId: Id<"tools">) {
    if (!window.confirm("Remove this listing? Pending requests will be declined.")) return;
    setError(null);
    setRemoving(toolId);
    try {
      await remove({ toolId });
    } catch (err) {
      setError(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Something went wrong",
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
        <Link href="/listings/new" className={primaryLink}>
          List a tool
        </Link>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        {tools === undefined ? (
          <p className="text-sm text-muted" aria-live="polite">
            Loading your listings…
          </p>
        ) : tools.length === 0 ? (
          <EmptyState
            title="You haven't listed anything yet"
            body="Lend a tool to a neighbor and it'll show up here."
            action={
              <Link href="/listings/new" className={primaryLink}>
                List a tool
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <li key={t._id} className="flex">
                <article className="flex w-full flex-col rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold leading-snug">{t.name}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.onLoan
                          ? "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {t.onLoan ? "On loan" : "Available"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <CategoryBadge category={t.category} />
                    <span>Condition: {CONDITION_LABELS[t.condition]}</span>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/80">
                    {t.description}
                  </p>
                  {t.pendingRequests > 0 ? (
                    <p className="mt-3 text-sm font-medium text-accent">
                      {t.pendingRequests} pending request{t.pendingRequests === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-4">
                    <Link
                      href={`/listings/${t._id}/edit`}
                      aria-label={`Edit ${t.name}`}
                      className="rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:border-accent"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={removing === t._id}
                      onClick={() => onDelete(t._id)}
                      aria-label={`Delete ${t.name}`}
                      className="rounded-full px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-400/10"
                    >
                      {removing === t._id ? "Removing…" : "Delete"}
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
