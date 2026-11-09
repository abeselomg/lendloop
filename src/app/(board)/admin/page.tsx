"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import { displayFirstName } from "@convex/lib/validation";
import type { Id } from "@convex/_generated/dataModel";
import { EmptyState } from "@/components/EmptyState";
import { StatusChip } from "@/components/StatusChip";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ActivityList } from "@/components/ActivityList";
import { LoanActionButton } from "@/components/LoanActionButton";
import { formatDateRange, relativeTime } from "@/lib/labels";
import { PageSkeleton, RowsSkeleton } from "@/components/Skeleton";

export default function AdminPage() {
  const me = useQuery(api.users.queries.me);
  if (me === undefined) return <PageSkeleton label="Loading" pathname="/admin" />;
  if (me === null || me.role !== "admin") {
    return (
      <EmptyState
        title="This page is for admins."
        body="Ask an admin to promote you if you need access."
      />
    );
  }
  return <AdminConsole />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function TrustToggle({
  userId,
  trusted,
  name,
}: {
  userId: Id<"users">;
  trusted: boolean;
  name: string;
}) {
  const setTrusted = useMutation(api.users.mutations.setTrustedLender);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setBusy(true);
    try {
      await setTrusted({ userId, trusted: !trusted });
    } catch (err) {
      setError(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        aria-pressed={trusted}
        aria-label={`Trusted lender: ${name}`}
        disabled={busy}
        onClick={onClick}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-60 ${
          trusted
            ? "border border-accent bg-accent-soft text-accent"
            : "border border-line hover:border-accent"
        }`}
      >
        {trusted ? <span aria-hidden="true">✓ </span> : null}
        Trusted lender
      </button>
    </>
  );
}

function AdminConsole() {
  const loans = useQuery(api.loans.queries.all);
  const tools = useQuery(api.tools.queries.listAllAdmin);
  const users = useQuery(api.users.queries.listAll);
  const failures = useQuery(api.automation.queries.listFailures);
  const removeTool = useMutation(api.tools.mutations.remove);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Section title="All loans">
        {loans === undefined ? (
          <RowsSkeleton label="Loading loans" />
        ) : loans.length === 0 ? (
          <Empty>No loans yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Tool</th>
                  <th scope="col" className="px-4 py-3 font-medium">Borrower</th>
                  <th scope="col" className="px-4 py-3 font-medium">Lender</th>
                  <th scope="col" className="px-4 py-3 font-medium">Dates</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loans.map((loan) => {
                  const last = loan.activity[0];
                  return (
                    <tr key={loan._id} className="align-top">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {loan.toolName}
                        {!loan.toolExists ? (
                          <span className="ml-1 text-xs font-normal text-muted">(removed)</span>
                        ) : null}
                      </th>
                      <td className="px-4 py-3">{loan.borrower.firstName}</td>
                      <td className="px-4 py-3">{loan.lender.firstName}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDateRange(loan.startDate, loan.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={loan.status} />
                      </td>
                      <td className="px-4 py-3 text-ink/80">
                        {last ? (
                          <>
                            {last.message}
                            <span className="ml-2 text-xs text-muted">
                              {relativeTime(last.createdAt)}
                            </span>
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
        )}
      </Section>

      <Section title="All listings">
        {tools === undefined ? (
          <RowsSkeleton label="Loading listings" />
        ) : tools.length === 0 ? (
          <Empty>No listings yet.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {tools.map((tool) => (
              <li
                key={tool._id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {tool.name}
                    <CategoryBadge category={tool.category} />
                    <span className="text-xs font-normal text-muted">
                      {tool.onLoan ? "On loan" : "Available"}
                    </span>
                  </p>
                  <p className="mt-0.5 break-all text-sm text-muted">
                    {tool.owner.firstName} · {tool.ownerEmail}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LoanActionButton
                    label="Remove"
                    pendingLabel="Removing…"
                    ariaLabel={`Remove listing ${tool.name}`}
                    variant="secondary"
                    confirmText="Remove this listing? Pending requests will be declined."
                    run={() => removeTool({ toolId: tool._id })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Neighbors">
        {users === undefined ? (
          <RowsSkeleton label="Loading neighbors" />
        ) : users.length === 0 ? (
          <Empty>No neighbors yet.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {users.map((u) => (
              <li
                key={u._id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
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
          </ul>
        )}
      </Section>

      <Section title="Automation failures">
        {failures === undefined ? (
          <RowsSkeleton label="Loading automation failures" />
        ) : failures.events.length === 0 && failures.errors.length === 0 ? (
          <Empty>No failures. Nice.</Empty>
        ) : (
          <div className="space-y-5">
            {failures.events.length > 0 ? (
              <ul className="space-y-1.5">
                {failures.events.map((e) => (
                  <li key={e._id} className="text-sm text-amber-800 dark:text-amber-300">
                    {e.type} for {e.toolName} — {e.attempts} attempts —{" "}
                    {e.lastError ?? "unknown error"}
                    <span className="ml-2 text-xs text-muted">{relativeTime(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {failures.errors.length > 0 ? <ActivityList entries={failures.errors} /> : null}
          </div>
        )}
      </Section>
    </div>
  );
}
