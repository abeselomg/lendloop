import type { LoanView } from "@convex/lib/views";
import { relativeTime } from "@/lib/labels";
import { describeActivity, type Perspective } from "@/lib/activity";

type ActivityEntry = LoanView["activity"][number];
type Kind = ActivityEntry["kind"];

const WARNING_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  "webhook_failed",
  "workflow_error",
  "notification_failed",
]);

/**
 * With a `perspective` (loan cards), entries are plain sentences for the borrower or lender and internal steps are
 * hidden. Without one (admin console), the technical messages are shown as recorded.
 */
export function ActivityList({ entries, perspective }: { entries: ActivityEntry[]; perspective?: Perspective }) {
  const rows = entries
    .map((e) => ({ e, text: perspective ? describeActivity(e, perspective) : e.message }))
    .filter((r): r is { e: ActivityEntry; text: string } => r.text !== null);
  if (rows.length === 0) {
    return perspective ? null : <p className="text-sm text-muted">No automation activity yet</p>;
  }
  return (
    <ul aria-label={perspective ? "Updates" : "Automation activity"} className="space-y-1.5">
      {rows.map(({ e, text }) => {
        const warn = WARNING_KINDS.has(e.kind);
        const isReminder = e.kind === "reminder_sent" && !perspective;
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
              {isReminder ? `Reminder sent ${relativeTime(e.createdAt)}` : text}
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
