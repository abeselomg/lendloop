export type PagingStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

export type PageSlice<T> = {
  items: T[];
  hasPrev: boolean;
  hasNext: boolean;
  /** 1-based row number of the first item on the page, 0 when the page is empty. */
  from: number;
  /** 1-based row number of the last item on the page, 0 when the page is empty. */
  to: number;
  /** True when moving to the next page needs the server to deliver more rows first. */
  needsLoad: boolean;
};

/**
 * The page we can actually show for a requested page. A requested page whose rows have not arrived yet resolves
 * to the last page that has rows, so the current page stays on screen while the next one loads.
 */
export function resolvePageIndex(requested: number, loadedCount: number, pageSize: number): number {
  const wanted = Math.max(0, requested);
  if (loadedCount > wanted * pageSize) return wanted;
  if (loadedCount === 0) return 0;
  return Math.floor((loadedCount - 1) / pageSize);
}

export function pageSlice<T>(
  results: readonly T[],
  pageIndex: number,
  pageSize: number,
  status: PagingStatus,
): PageSlice<T> {
  const start = pageIndex * pageSize;
  const items = results.slice(start, start + pageSize);
  const loadedBeyond = results.length > start + pageSize;
  return {
    items,
    hasPrev: pageIndex > 0,
    hasNext: loadedBeyond || status === "CanLoadMore" || status === "LoadingMore",
    from: items.length > 0 ? start + 1 : 0,
    to: start + items.length,
    needsLoad: status === "CanLoadMore" && results.length < start + 2 * pageSize,
  };
}
