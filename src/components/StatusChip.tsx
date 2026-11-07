import type { LoanStatus } from "@convex/lib/validation";
import { STATUS_LABELS } from "@/lib/labels";

const STYLES: Record<LoanStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
  declined: "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300",
  cancelled: "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300",
  returned: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200",
};

export function StatusChip({ status }: { status: LoanStatus }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
