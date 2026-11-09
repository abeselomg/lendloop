"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { ToolView } from "@convex/lib/views";
import { CONDITION_LABELS } from "@/lib/labels";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useCategories } from "@/lib/hooks/useCategories";
import { TrustedMark } from "@/components/TrustedMark";

// One filled element per card (the action); everything else is text, so the eye goes name → details → action.
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
  const categories = useCategories();
  const details = `${categories.label(tool.category)}, ${CONDITION_LABELS[tool.condition].toLowerCase()} condition`;

  return (
    <article className="flex w-full flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <CategoryIcon icon={categories.icon(tool.category)} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-snug">{tool.name}</h3>
            <Availability onLoan={tool.onLoan} />
          </div>
          <p className="mt-0.5 text-sm text-muted">{details}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            {tool.owner.isMe ? (
              "Your listing"
            ) : (
              <>
                <span className="truncate">
                  Lent by <span className="font-medium text-ink">{tool.owner.firstName}</span>
                </span>
                {tool.owner.trustedLender ? <TrustedMark /> : null}
              </>
            )}
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-ink/80">{tool.description}</p>

      {pendingRequests > 0 ? (
        <p className="mt-3 text-sm font-medium text-accent">
          {pendingRequests} pending request{pendingRequests === 1 ? "" : "s"}
        </p>
      ) : null}

      {/* Same footer on every card: one row, actions on the right. */}
      <div className="mt-5 flex min-h-9 items-center justify-end gap-2 border-t border-line pt-4">
        {manage ??
          (onRequest ? (
            <button
              type="button"
              onClick={onRequest}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              Request to borrow
            </button>
          ) : tool.owner.isMe ? (
            <Link
              href={`/listings/${tool._id}/edit`}
              className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink hover:border-accent/50"
            >
              Edit listing
            </Link>
          ) : null)}
      </div>
    </article>
  );
}

function Availability({ onLoan }: { onLoan: boolean }) {
  return (
    <span
      className={`mt-0.5 flex shrink-0 items-center gap-1.5 text-xs font-medium ${
        onLoan ? "text-amber-700 dark:text-amber-300" : "text-accent"
      }`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${onLoan ? "bg-amber-500" : "bg-accent"}`} />
      {onLoan ? "On loan" : "Available"}
    </span>
  );
}
