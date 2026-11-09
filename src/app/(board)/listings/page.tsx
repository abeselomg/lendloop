"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { ToolCard } from "@/components/ToolCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { ToolGridSkeleton } from "@/components/Skeleton";

const primaryLink =
  "rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

export default function ListingsPage() {
  const pager = usePagedQuery(api.tools.queries.mine, {}, { pageSize: 12 });
  const remove = useMutation(api.tools.mutations.remove);
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
        {pager.isLoading ? (
          <ToolGridSkeleton label="Loading your listings" count={3} />
        ) : pager.items.length === 0 ? (
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
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pager.items.map((t) => (
                <li key={t._id} className="flex">
                  <ToolCard
                    tool={t}
                    pendingRequests={t.pendingRequests}
                    manage={
                      <>
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
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
            <Pagination pager={pager} label="listings" />
          </>
        )}
      </div>
    </div>
  );
}
