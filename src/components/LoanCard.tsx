import type { ReactNode } from "react";
import type { LoanView } from "@convex/lib/views";
import { todayUtc } from "@convex/lib/validation";
import { formatDateRange } from "@/lib/labels";
import { StatusChip } from "@/components/StatusChip";
import { ActivityList } from "@/components/ActivityList";

export function LoanCard({ loan, actions }: { loan: LoanView; actions: ReactNode }) {
  const overdue = loan.status === "approved" && loan.endDate < todayUtc();
  const asBorrower = loan.viewerRole === "borrower";
  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">
            {loan.toolName}
            {!loan.toolExists ? (
              <span className="ml-2 text-sm font-normal text-muted">(listing removed)</span>
            ) : null}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {asBorrower ? (
              <>
                From {loan.lender.firstName}
                {loan.lender.trustedLender ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    Trusted lender
                  </span>
                ) : null}
              </>
            ) : (
              <>For {loan.borrower.firstName}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overdue ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-400/15 dark:text-red-200">
              Overdue
            </span>
          ) : null}
          <StatusChip status={loan.status} />
        </div>
      </div>
      <p className="mt-2 text-sm">{formatDateRange(loan.startDate, loan.endDate)}</p>
      {loan.note ? (
        <p className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm italic text-ink/80">{loan.note}</p>
      ) : null}
      <div className="mt-4 border-t border-line pt-4">
        <ActivityList entries={loan.activity} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </article>
  );
}
