import type { ReactNode } from "react";
import type { LoanView } from "@convex/lib/views";
import { daysBetween, todayUtc } from "@convex/lib/validation";
import { formatDay } from "@/lib/labels";
import { StatusChip } from "@/components/StatusChip";
import { ActivityList } from "@/components/ActivityList";

export function LoanCard({ loan, actions }: { loan: LoanView; actions: ReactNode }) {
  const overdue = loan.status === "approved" && loan.endDate < todayUtc();
  const asBorrower = loan.viewerRole === "borrower";
  const days = daysBetween(loan.startDate, loan.endDate) + 1;
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
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">From</dt>
          <dd className="font-medium">{formatDay(loan.startDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Until</dt>
          <dd className="font-medium">{formatDay(loan.endDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Length</dt>
          <dd className="font-medium">{days} {days === 1 ? "day" : "days"}</dd>
        </div>
      </dl>
      {loan.note ? (
        <p className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm italic text-ink/80">{loan.note}</p>
      ) : null}
      {loan.activity.some((e) => e.kind !== "webhook_delivered") ? (
        <div className="mt-4 border-t border-line pt-4">
          <ActivityList
            entries={loan.activity}
            perspective={{
              viewerRole: loan.viewerRole,
              borrowerName: loan.borrower.firstName,
              lenderName: loan.lender.firstName,
            }}
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </article>
  );
}
