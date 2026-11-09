"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CATEGORIES, type Category } from "@convex/lib/validation";
import type { ToolView } from "@convex/lib/views";
import { CATEGORY_LABELS } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";
import { ToolCard } from "@/components/ToolCard";
import { RequestDialog } from "@/components/RequestDialog";
import { ToolGridSkeleton } from "@/components/Skeleton";

function chip(active: boolean) {
  return `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent text-accent-ink"
      : "border-line bg-surface text-ink hover:border-accent"
  }`;
}

export default function BrowsePage() {
  const [category, setCategory] = useState<Category | null>(null);
  const [requesting, setRequesting] = useState<ToolView | null>(null);
  const [sent, setSent] = useState(false);
  const tools = useQuery(api.tools.queries.list, category ? { category } : {});

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 3000);
    return () => clearTimeout(t);
  }, [sent]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Browse tools</h1>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
          className={chip(category === null)}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={chip(category === c)}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="mt-4 h-6 text-sm font-medium text-accent" role="status">
        {sent ? "Request sent" : ""}
      </div>

      <div className="mt-2">
        {tools === undefined ? (
          <ToolGridSkeleton label="Loading tools" />
        ) : tools.length === 0 ? (
          <EmptyState
            title="No tools in this category yet."
            body="Try another category or list one yourself."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <li key={t._id} className="flex">
                <ToolCard
                  tool={t}
                  onRequest={!t.owner.isMe ? () => setRequesting(t) : undefined}
                />
              </li>
            ))}
          </ul>
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
