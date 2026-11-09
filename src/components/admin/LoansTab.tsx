"use client";

import { useState } from "react";
import { api } from "@convex/_generated/api";
import { LOAN_STATUSES, type LoanStatus } from "@convex/lib/validation";
import { StatusChip } from "@/components/StatusChip";
import { Pagination } from "@/components/ui/Pagination";
import { RowsSkeleton } from "@/components/Skeleton";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { STATUS_LABELS, formatDateRange, relativeTime } from "@/lib/labels";
import { Empty, INPUT } from "./shared";

type Filter = LoanStatus | "all";
const HEADERS = ["Tool", "Borrower", "Lender", "Dates", "Status", "Last activity"];

export function LoansTab() {
  const [filter, setFilter] = useState<Filter>("all");
  const pager = usePagedQuery(api.loans.queries.all, filter === "all" ? {} : { status: filter }, { pageSize: 10 });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="admin-loan-status" className="text-sm text-muted">
          Status
        </label>
        <select id="admin-loan-status" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={INPUT}>
          <option value="all">All</option>
          {LOAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {pager.isLoading ? (
        <RowsSkeleton label="Loading loans" />
      ) : pager.items.length === 0 ? (
        <Empty>{filter === "all" ? "No loans yet." : "No loans with this status."}</Empty>
      ) : (
        <>
          {/* Stacked cards below md, a table from md up: no sideways scrolling either way. */}
          <ul aria-label="Loans" className="divide-y divide-line rounded-2xl border border-line bg-surface md:hidden">
            {pager.items.map((loan) => {
              const last = loan.activity[0];
              return (
                <li key={loan._id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-medium">
                      {loan.toolName}
                      {!loan.toolExists ? <span className="ml-1 text-xs font-normal text-muted">(removed)</span> : null}
                    </p>
                    <StatusChip status={loan.status} />
                  </div>
                  <p className="text-sm text-muted">
                    {loan.borrower.firstName} borrowing from {loan.lender.firstName}
                  </p>
                  <p className="text-sm">{formatDateRange(loan.startDate, loan.endDate)}</p>
                  {last ? (
                    <p className="text-xs text-muted">
                      {last.message} · {relativeTime(last.createdAt)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="hidden rounded-2xl border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">All loans</caption>
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pager.items.map((loan) => {
                  const last = loan.activity[0];
                  return (
                    <tr key={loan._id} className="align-top">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {loan.toolName}
                        {!loan.toolExists ? <span className="ml-1 text-xs font-normal text-muted">(removed)</span> : null}
                      </th>
                      <td className="px-4 py-3">{loan.borrower.firstName}</td>
                      <td className="px-4 py-3">{loan.lender.firstName}</td>
                      <td className="px-4 py-3">{formatDateRange(loan.startDate, loan.endDate)}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={loan.status} />
                      </td>
                      <td className="px-4 py-3 text-ink/80">
                        {last ? (
                          <>
                            {last.message}
                            <span className="ml-2 text-xs text-muted">{relativeTime(last.createdAt)}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination pager={pager} label="loans" />
    </div>
  );
}
