"use client";

import { useCategories } from "@/lib/hooks/useCategories";

export function CategoryBadge({ slug }: { slug: string }) {
  const { label } = useCategories();
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
      {label(slug)}
    </span>
  );
}
