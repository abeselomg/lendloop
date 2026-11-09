import type { Pager } from "@/lib/hooks/usePagedQuery";

const BUTTON =
  "rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-inherit";

export function Pagination({ pager, label }: { pager: Pager; label: string }) {
  if (pager.pageIndex === 0 && !pager.hasNext) return null;

  const range = pager.from === 0 ? "No more" : pager.from === pager.to ? `${pager.from}` : `${pager.from}–${pager.to}`;

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <p className="text-sm text-muted" aria-live="polite">
        Showing {range} {label}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={pager.prev}
          disabled={!pager.hasPrev}
          aria-label={`Previous page of ${label}`}
          className={BUTTON}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={pager.next}
          disabled={!pager.hasNext || pager.isLoadingPage}
          aria-label={`Next page of ${label}`}
          className={BUTTON}
        >
          {pager.isLoadingPage ? "Loading…" : "Next"}
        </button>
      </div>
    </nav>
  );
}
