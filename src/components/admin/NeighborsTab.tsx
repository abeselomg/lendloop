"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { displayFirstName } from "@convex/lib/validation";
import type { Id } from "@convex/_generated/dataModel";
import { Pagination } from "@/components/ui/Pagination";
import { RowsSkeleton } from "@/components/Skeleton";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { Empty, InlineError, RowList, useAction } from "./shared";

function TrustToggle({ userId, trusted, name }: { userId: Id<"users">; trusted: boolean; name: string }) {
  const setTrusted = useMutation(api.users.mutations.setTrustedLender);
  const { busy, error, run } = useAction();

  return (
    <>
      <InlineError>{error}</InlineError>
      <button
        type="button"
        aria-pressed={trusted}
        aria-label={`Trusted lender: ${name}`}
        disabled={busy}
        onClick={() => run(() => setTrusted({ userId, trusted: !trusted }))}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
          trusted ? "border border-accent bg-accent-soft text-accent" : "border border-line hover:border-accent"
        }`}
      >
        {trusted ? <span aria-hidden="true">✓ </span> : null}
        Trusted lender
      </button>
    </>
  );
}

export function NeighborsTab() {
  const pager = usePagedQuery(api.users.queries.listAll, {}, { pageSize: 10 });

  return (
    <div>
      {pager.isLoading ? (
        <RowsSkeleton label="Loading neighbors" />
      ) : pager.items.length === 0 ? (
        <Empty>No neighbors yet.</Empty>
      ) : (
        <RowList label="Neighbors">
          {pager.items.map((u) => (
            <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.name || displayFirstName({ email: u.email })}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-accent-soft text-accent"
                        : "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
                    }`}
                  >
                    {u.role}
                  </span>
                </p>
                <p className="mt-0.5 break-all text-sm text-muted">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TrustToggle userId={u._id} trusted={u.trustedLender} name={u.name || u.email} />
              </div>
            </li>
          ))}
        </RowList>
      )}
      <Pagination pager={pager} label="neighbors" />
    </div>
  );
}
