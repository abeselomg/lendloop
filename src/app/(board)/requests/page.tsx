"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { todayUtc } from "@convex/lib/validation";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { LoanCard } from "@/components/LoanCard";
import { LoanActionButton } from "@/components/LoanActionButton";
import { LoanListSkeleton } from "@/components/Skeleton";

export default function RequestsPage() {
  const pager = usePagedQuery(api.loans.queries.mine, {}, { pageSize: 6 });
  const cancel = useMutation(api.loans.mutations.cancel);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
      <div className="mt-6">
        {pager.isLoading ? (
          <LoanListSkeleton label="Loading your requests" />
        ) : pager.items.length === 0 ? (
          <EmptyState
            title="No requests yet"
            body="Find something to borrow on the Browse page."
            action={
              <Link
                href="/browse"
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
              >
                Browse tools
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-4">
              {pager.items.map((loan) => {
                const cancellable =
                  loan.status === "pending" ||
                  (loan.status === "approved" && loan.startDate > todayUtc());
                return (
                  <li key={loan._id}>
                    <LoanCard
                      loan={loan}
                      actions={
                        cancellable ? (
                          <LoanActionButton
                            label="Cancel request"
                            pendingLabel="Cancelling…"
                            ariaLabel={`Cancel request for ${loan.toolName}`}
                            variant="secondary"
                            confirmText="Cancel this request?"
                            run={() => cancel({ loanId: loan._id })}
                          />
                        ) : null
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <Pagination pager={pager} label="requests" />
          </>
        )}
      </div>
    </div>
  );
}
