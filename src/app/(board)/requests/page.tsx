"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { todayUtc } from "@convex/lib/validation";
import { EmptyState } from "@/components/EmptyState";
import { LoanCard } from "@/components/LoanCard";
import { LoanActionButton } from "@/components/LoanActionButton";
import { LoanListSkeleton } from "@/components/Skeleton";

export default function RequestsPage() {
  const loans = useQuery(api.loans.mine);
  const cancel = useMutation(api.loans.cancel);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
      <div className="mt-6">
        {loans === undefined ? (
          <LoanListSkeleton label="Loading your requests" />
        ) : loans.length === 0 ? (
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
          <ul className="space-y-4">
            {loans.map((loan) => {
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
        )}
      </div>
    </div>
  );
}
