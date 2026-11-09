"use client";

import { useState } from "react";
import {
  usePaginatedQuery,
  type PaginatedQueryArgs,
  type PaginatedQueryItem,
  type PaginatedQueryReference,
} from "convex/react";
import { pageSlice, resolvePageIndex } from "@/lib/paging";

export type Pager = {
  pageIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  prev: () => void;
  next: () => void;
  /** First page has not arrived yet. */
  isLoading: boolean;
  /** More rows are being fetched (next page requested). Items still show the previous page. */
  isLoadingPage: boolean;
  /** 1-based row numbers for "Showing 11-20". 0 when empty. */
  from: number;
  to: number;
};

export type PagedResult<T> = Pager & {
  /** Rows of the current page. */
  items: T[];
};

/** Page-by-page navigation on top of Convex's load-more pagination. */
export function usePagedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  { pageSize }: { pageSize: number },
): PagedResult<PaginatedQueryItem<Query>> {
  const { results, status, loadMore } = usePaginatedQuery(query, args, { initialNumItems: pageSize });

  // The requested page belongs to one set of args; different args read as page 0 without an effect.
  const argsKey = JSON.stringify(args);
  const [requested, setRequested] = useState({ key: argsKey, index: 0 });
  const wanted = requested.key === argsKey ? requested.index : 0;

  const pageIndex = resolvePageIndex(wanted, results.length, pageSize);
  const slice = pageSlice(results, pageIndex, pageSize, status);

  return {
    items: slice.items,
    pageIndex,
    hasPrev: slice.hasPrev,
    hasNext: slice.hasNext,
    prev: () => setRequested({ key: argsKey, index: Math.max(0, pageIndex - 1) }),
    next: () => {
      if (!slice.hasNext || wanted > pageIndex) return;
      if (slice.needsLoad) loadMore(pageSize);
      setRequested({ key: argsKey, index: pageIndex + 1 });
    },
    isLoading: args !== "skip" && status === "LoadingFirstPage",
    isLoadingPage: wanted > pageIndex || status === "LoadingMore",
    from: slice.from,
    to: slice.to,
  };
}
