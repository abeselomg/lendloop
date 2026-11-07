import type { LoanView } from "@convex/lib/views";
import { relativeTime } from "@/lib/labels";

type ActivityEntry = LoanView["activity"][number];
type Kind = ActivityEntry["kind"];

const WARNING_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  "webhook_failed",
  "workflow_error",
  "notification_failed",
]);

export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted">No automation activity yet</p>;
  }
  return (
    <ul aria-label="Automation activity" className="space-y-1.5">
      {entries.map((e) => {
        const warn = WARNING_KINDS.has(e.kind);
        const isReminder = e.kind === "reminder_sent";
        return (
          <li
            key={e._id}
            className={`flex items-start gap-2 text-sm ${
              warn ? "text-amber-800 dark:text-amber-300" : "text-ink/80"
            }`}
          >
            {warn ? (
              <span aria-hidden="true" className="w-3 shrink-0 text-center font-bold leading-5">
                !
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="mt-2 ml-0.5 size-2 shrink-0 rounded-full bg-accent"
              />
            )}
            <span className="min-w-0 flex-1">
              {warn ? <span className="sr-only">Warning: </span> : null}
              {isReminder ? `Reminder sent ${relativeTime(e.createdAt)}` : e.message}
              {isReminder ? null : (
                <span className="ml-2 text-xs text-muted">{relativeTime(e.createdAt)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
