"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CATEGORIES } from "@convex/lib/validation";
import { CATEGORY_LABELS } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";

export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <p className="text-sm text-muted" aria-live="polite">
        Loading the board…
      </p>
    );
  }
  if (tools.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        body="No tools listed yet. Be the first neighbor to lend something."
      />
    );
  }

  return (
    <div className="space-y-8">
      {CATEGORIES.map((cat) => {
        const items = tools.filter((t) => t.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-sm font-medium text-muted">{CATEGORY_LABELS[cat]}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <li
                  key={t._id}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium"
                >
                  {t.name}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
