"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { iconFor, labelFor, type CategoryRow } from "@/lib/categories";

export type { CategoryRow };

export function useCategories() {
  // `api.categories.queries.list` only exists in the generated types after codegen.
  const rows = useQuery(api.categories.queries.list) as CategoryRow[] | undefined;
  return useMemo(() => {
    const all = rows ?? [];
    return {
      all,
      active: all.filter((c) => c.active),
      label: (slug: string) => labelFor(all, slug),
      icon: (slug: string) => iconFor(all, slug),
      isLoading: rows === undefined,
    };
  }, [rows]);
}
