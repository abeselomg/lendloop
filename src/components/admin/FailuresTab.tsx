"use client";

import { api } from "@convex/_generated/api";
import { EVENT_LABELS } from "@convex/lib/validation";
import { ActivityList } from "@/components/ActivityList";
import { Pagination } from "@/components/ui/Pagination";
import { RowsSkeleton } from "@/components/Skeleton";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { relativeTime } from "@/lib/labels";
import { Empty, RowList } from "./shared";

function UndeliveredNotifications() {
  const pager = usePagedQuery(api.automation.queries.failedEvents, {}, { pageSize: 10 });
  return (
    <section aria-labelledby="failed-events-heading">
      <h2 id="failed-events-heading" className="mb-3 text-base font-semibold tracking-tight">
        Undelivered notifications
      </h2>
      {pager.isLoading ? (
        <RowsSkeleton label="Loading undelivered notifications" rows={2} />
      ) : pager.items.length === 0 ? (
        <Empty>No failures. Every notification went through.</Empty>
      ) : (
        <RowList label="Undelivered notifications">
          {pager.items.map((e) => (
            <li key={e._id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                {e.toolName}
                <span className="ml-2 font-normal text-muted">
                  {EVENT_LABELS[e.type as keyof typeof EVENT_LABELS] ?? e.type}
                </span>
              </p>
              <p className="mt-0.5 break-words text-amber-800 dark:text-amber-300">{e.lastError ?? "Unknown error"}</p>
              <p className="mt-0.5 text-xs text-muted">
                {e.attempts} {e.attempts === 1 ? "attempt" : "attempts"} · {relativeTime(e.createdAt)}
              </p>
            </li>
          ))}
        </RowList>
      )}
      <Pagination pager={pager} label="failed notifications" />
    </section>
  );
}

function WorkflowErrors() {
  const pager = usePagedQuery(api.automation.queries.workflowErrors, {}, { pageSize: 10 });
  return (
    <section aria-labelledby="workflow-errors-heading">
      <h2 id="workflow-errors-heading" className="mb-3 text-base font-semibold tracking-tight">
        Workflow errors
      </h2>
      {pager.isLoading ? (
        <RowsSkeleton label="Loading workflow errors" rows={2} />
      ) : pager.items.length === 0 ? (
        <Empty>No workflow errors.</Empty>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <ActivityList entries={pager.items} />
        </div>
      )}
      <Pagination pager={pager} label="workflow errors" />
    </section>
  );
}

export function FailuresTab() {
  return (
    <div className="space-y-8">
      <UndeliveredNotifications />
      <WorkflowErrors />
    </div>
  );
}
