"use client";

import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { ToolView } from "@convex/lib/views";
import { useCategories } from "@/lib/hooks/useCategories";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { EmptyState } from "@/components/EmptyState";
import { ToolCard } from "@/components/ToolCard";
import { RequestDialog } from "@/components/RequestDialog";
import { ToolGridSkeleton } from "@/components/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";

function chip(active: boolean) {
  return `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent text-accent-ink"
      : "border-line bg-surface text-ink hover:border-accent"
  }`;
}

export default function BrowsePage() {
  const { active } = useCategories();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // SearchInput owns its text; bumping the key remounts it empty.
  const [searchKey, setSearchKey] = useState(0);
  const [requesting, setRequesting] = useState<ToolView | null>(null);
  const [sent, setSent] = useState(false);
  const term = search.trim();
  const pager = usePagedQuery(
    api.tools.queries.list,
    { ...(category ? { category } : {}), ...(term ? { search: term } : {}) },
    { pageSize: 12 },
  );

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 3000);
    return () => clearTimeout(t);
  }, [sent]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Browse tools</h1>
      <SearchInput
        key={searchKey}
        label="Search tools"
        placeholder="Search by name"
        onChange={setSearch}
        className="mt-5 max-w-md"
      />
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
          className={chip(category === null)}
        >
          All
        </button>
        {active.map((c) => (
          <button
            key={c.slug}
            type="button"
            aria-pressed={category === c.slug}
            onClick={() => setCategory(c.slug)}
            className={chip(category === c.slug)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 h-6 text-sm font-medium text-accent" role="status">
        {sent ? "Request sent" : ""}
      </div>

      <div className="mt-2">
        {pager.isLoading ? (
          <ToolGridSkeleton label="Loading tools" />
        ) : pager.items.length === 0 ? (
          term ? (
            <EmptyState
              title={`No tools match “${term}”`}
              body="Check the spelling or try a shorter search."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchKey((k) => k + 1);
                  }}
                  className="rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:border-accent"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <EmptyState
              title="No tools in this category yet."
              body="Try another category or list one yourself."
            />
          )
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pager.items.map((t) => (
                <li key={t._id} className="flex">
                  <ToolCard
                    tool={t}
                    onRequest={!t.owner.isMe ? () => setRequesting(t) : undefined}
                  />
                </li>
              ))}
            </ul>
            <Pagination pager={pager} label="tools" />
          </>
        )}
      </div>

      <RequestDialog
        tool={requesting}
        onClose={() => setRequesting(null)}
        onSent={() => setSent(true)}
      />
    </div>
  );
}
