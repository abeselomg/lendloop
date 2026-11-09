"use client";

import { Suspense } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs, useTabParam } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/EmptyState";
import { LoanCard } from "@/components/LoanCard";
import { LoanActionButton } from "@/components/LoanActionButton";
import { LoanListSkeleton } from "@/components/Skeleton";

type Group = "pending" | "active" | "history";

const TABS: { id: Group; label: string }[] = [
  { id: "pending", label: "Needs your decision" },
  { id: "active", label: "Active loans" },
  { id: "history", label: "History" },
];

const EMPTY: Record<Group, { title: string; body: string }> = {
  pending: {
    title: "Nothing waiting on you",
    body: "When neighbors ask to borrow your tools, their requests land here.",
  },
  active: {
    title: "No active loans",
    body: "Approved requests show up here until the tool is back.",
  },
  history: {
    title: "No history yet",
    body: "Declined, cancelled and returned loans end up here.",
  },
};

export default function IncomingPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Incoming requests</h1>
      <div className="mt-6">
        <Suspense fallback={<LoanListSkeleton label="Loading incoming requests" />}>
          <IncomingTabs />
        </Suspense>
      </div>
    </div>
  );
}

function IncomingTabs() {
  const [tab, setTab] = useTabParam("tab", "pending");
  const group: Group = TABS.some((t) => t.id === tab) ? (tab as Group) : "pending";
  return (
    <Tabs tabs={TABS} value={group} onChange={setTab} label="Incoming requests">
      <IncomingList key={group} group={group} />
    </Tabs>
  );
}

function IncomingList({ group }: { group: Group }) {
  const pager = usePagedQuery(api.loans.queries.incoming, { group }, { pageSize: 6 });
  const approve = useMutation(api.loans.mutations.approve);
  const decline = useMutation(api.loans.mutations.decline);
  const markReturned = useMutation(api.loans.mutations.markReturned);

  if (pager.isLoading) return <LoanListSkeleton label="Loading incoming requests" />;
  if (pager.items.length === 0) return <EmptyState {...EMPTY[group]} />;

  return (
    <>
      <ul className="space-y-4">
        {pager.items.map((loan) => (
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
      <Pagination pager={pager} label="requests" />
    </>
  );
}
