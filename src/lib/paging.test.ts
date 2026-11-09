import { describe, expect, it } from "vitest";
import { pageSlice, resolvePageIndex } from "./paging";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("pageSlice", () => {
  it("slices the first page and can load more", () => {
    const s = pageSlice(rows(10), 0, 10, "CanLoadMore");
    expect(s.items).toEqual(rows(10));
    expect([s.hasPrev, s.hasNext, s.from, s.to, s.needsLoad]).toEqual([false, true, 1, 10, true]);
  });

  it("has next without a load when rows are already loaded", () => {
    const s = pageSlice(rows(30), 0, 10, "CanLoadMore");
    expect(s.hasNext).toBe(true);
    expect(s.needsLoad).toBe(false);
  });

  it("shows a short last page when exhausted", () => {
    const s = pageSlice(rows(14), 1, 10, "Exhausted");
    expect(s.items).toEqual([11, 12, 13, 14]);
    expect([s.hasPrev, s.hasNext, s.from, s.to, s.needsLoad]).toEqual([true, false, 11, 14, false]);
  });

  it("has no next on an exactly full exhausted page", () => {
    expect(pageSlice(rows(10), 0, 10, "Exhausted").hasNext).toBe(false);
  });

  it("keeps hasNext true while loading more", () => {
    const s = pageSlice(rows(10), 0, 10, "LoadingMore");
    expect(s.hasNext).toBe(true);
    expect(s.needsLoad).toBe(false);
  });

  it("handles an empty result", () => {
    const s = pageSlice([], 0, 10, "Exhausted");
    expect(s).toEqual({ items: [], hasPrev: false, hasNext: false, from: 0, to: 0, needsLoad: false });
  });
});

describe("resolvePageIndex", () => {
  it("returns the requested page when its rows are loaded", () => {
    expect(resolvePageIndex(1, 15, 10)).toBe(1);
  });
  it("falls back to the last loaded page while the next one loads", () => {
    expect(resolvePageIndex(1, 10, 10)).toBe(0);
  });
  it("clamps past the end", () => {
    expect(resolvePageIndex(3, 14, 10)).toBe(1);
  });
  it("is 0 with no rows", () => {
    expect(resolvePageIndex(2, 0, 10)).toBe(0);
  });
});
