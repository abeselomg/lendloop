"use client";

import type { ReactNode } from "react";
import type { ToolView } from "@convex/lib/views";
import { CONDITION_LABELS } from "@/lib/labels";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useCategories } from "@/lib/hooks/useCategories";

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
        </div>
      </div>

      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-ink/80">{tool.description}</p>

      {pendingRequests > 0 ? (
        <p className="mt-3 text-sm font-medium text-accent">
          {pendingRequests} pending request{pendingRequests === 1 ? "" : "s"}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {manage ? (
          <div className="ml-auto flex items-center gap-2">{manage}</div>
        ) : (
          <>
            <p className="min-w-0 text-sm text-muted">
              Lent by <span className="font-medium text-ink">{tool.owner.firstName}</span>
              {tool.owner.trustedLender ? <TrustedMark /> : null}
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
          </>
        )}
      </div>
    </article>
  );
}

function Availability({ onLoan }: { onLoan: boolean }) {
  return (
    <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
      <span aria-hidden="true" className={`size-2 rounded-full ${onLoan ? "bg-stone-400" : "bg-accent"}`} />
      {onLoan ? "On loan" : "Available"}
    </span>
  );
}

function TrustedMark() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-accent">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5 2.5 3.8v3.7c0 3.2 2.3 5.8 5.5 7 3.2-1.2 5.5-3.8 5.5-7V3.8z" />
        <path d="m5.6 8 1.7 1.7 3.2-3.4" />
      </svg>
      Trusted lender
    </span>
  );
}
