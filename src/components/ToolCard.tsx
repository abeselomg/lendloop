import type { ReactNode } from "react";
import type { ToolView } from "@convex/lib/views";
import { CONDITION_LABELS } from "@/lib/labels";
import { CategoryBadge } from "@/components/CategoryBadge";

export function ToolCard({
  tool,
  onRequest,
  manage,
  pendingRequests = 0,
}: {
  tool: ToolView;
  onRequest?: () => void;
  /** Owner view: replaces the lender footer with edit/delete style actions. */
  manage?: ReactNode;
  pendingRequests?: number;
}) {
  return (
    <article className="flex w-full flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{tool.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            tool.onLoan
              ? "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
              : "bg-accent-soft text-accent"
          }`}
        >
          {tool.onLoan ? "On loan" : "Available"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <CategoryBadge slug={tool.category} />
        <span>Condition: {CONDITION_LABELS[tool.condition]}</span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/80">{tool.description}</p>
      {pendingRequests > 0 ? (
        <p className="mt-3 text-sm font-medium text-accent">
          {pendingRequests} pending request{pendingRequests === 1 ? "" : "s"}
        </p>
      ) : null}
      {manage ? (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-4">{manage}</div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            Lent by {tool.owner.firstName}
            {tool.owner.trustedLender ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                Trusted lender
              </span>
            ) : null}
          </p>
          {onRequest ? (
            <button
              type="button"
              onClick={onRequest}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              Request to borrow
            </button>
          ) : tool.owner.isMe ? (
            <span className="text-sm text-muted">Your listing</span>
          ) : null}
        </div>
      )}
    </article>
  );
}
