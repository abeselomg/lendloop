export type CategoryRow = {
  _id: string;
  slug: string;
  label: string;
  icon: string;
  active: boolean;
  order: number;
  toolCount: number;
};

// Tools keep the slug of a category even after it is archived, so lookups never fail hard.
export function labelFor(rows: readonly CategoryRow[], slug: string): string {
  return rows.find((c) => c.slug === slug)?.label ?? slug;
}

export function iconFor(rows: readonly CategoryRow[], slug: string): string {
  return rows.find((c) => c.slug === slug)?.icon ?? "other";
}
