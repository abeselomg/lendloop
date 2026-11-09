"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/EmptyState";
import { LoanCard } from "@/components/LoanCard";
import { LoanActionButton } from "@/components/LoanActionButton";
import { LoanListSkeleton } from "@/components/Skeleton";

export default function IncomingPage() {
  const loans = useQuery(api.loans.incoming);
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);

  const sections = loans
    ? [
        { title: "Needs your decision", items: loans.filter((l) => l.status === "pending") },
        { title: "Active loans", items: loans.filter((l) => l.status === "approved") },
        {
          title: "History",
          items: loans.filter(
            (l) => l.status === "declined" || l.status === "returned" || l.status === "cancelled",
          ),
        },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Incoming requests</h1>
      <div className="mt-6">
        {loans === undefined ? (
          <LoanListSkeleton label="Loading incoming requests" />
        ) : loans.length === 0 ? (
          <EmptyState
            title="Nothing incoming yet"
            body="When neighbors ask to borrow your tools, their requests land here."
          />
        ) : (
          <div className="space-y-8">
            {sections
              .filter((s) => s.items.length > 0)
              .map((s) => (
                <section key={s.title}>
                  <h2 className="text-lg font-semibold">{s.title}</h2>
                  <ul className="mt-3 space-y-4">
                    {s.items.map((loan) => (
                      <li key={loan._id}>
                        <LoanCard
                          loan={loan}
                          actions={
                            loan.status === "pending" ? (
                              <>
                                <LoanActionButton
                                  label="Decline"
                                  pendingLabel="Declining…"
                                  ariaLabel={`Decline request for ${loan.toolName}`}
                                  variant="secondary"
                                  run={() => decline({ loanId: loan._id })}
                                />
                                <LoanActionButton
                                  label="Approve"
                                  pendingLabel="Approving…"
                                  ariaLabel={`Approve request for ${loan.toolName}`}
                                  variant="primary"
                                  run={() => approve({ loanId: loan._id })}
                                />
                              </>
                            ) : loan.status === "approved" ? (
                              <LoanActionButton
                                label="Mark returned"
                                pendingLabel="Saving…"
                                ariaLabel={`Mark ${loan.toolName} as returned`}
                                variant="primary"
                                run={() => markReturned({ loanId: loan._id })}
                              />
                            ) : null
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
