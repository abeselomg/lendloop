import type { Category } from "@convex/lib/validation";
import { CATEGORY_LABELS } from "@/lib/labels";

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
      {CATEGORY_LABELS[category]}
    </span>
  );
}
