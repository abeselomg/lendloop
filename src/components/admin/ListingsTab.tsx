"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { RowsSkeleton } from "@/components/Skeleton";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { ConfirmButton, Empty, RowList } from "./shared";

export function ListingsTab() {
  const [search, setSearch] = useState("");
  const pager = usePagedQuery(api.tools.queries.listAllAdmin, { search }, { pageSize: 10 });
  const removeTool = useMutation(api.tools.mutations.remove);

  return (
    <div>
      <SearchInput label="Search listings" placeholder="Search listings by name" onChange={setSearch} className="mb-4 max-w-sm" />
      {pager.isLoading ? (
        <RowsSkeleton label="Loading listings" />
      ) : pager.items.length === 0 ? (
        <Empty>{search.trim() ? "No listings match your search." : "No listings yet."}</Empty>
      ) : (
        <RowList label="Listings">
          {pager.items.map((tool) => (
            <li key={tool._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {tool.name}
                  <CategoryBadge slug={tool.category} />
                  <span className="text-xs font-normal text-muted">{tool.onLoan ? "On loan" : "Available"}</span>
                </p>
                <p className="mt-0.5 break-all text-sm text-muted">
                  {tool.owner.firstName} · {tool.ownerEmail}
                </p>
              </div>
              <ConfirmButton
                label="Remove"
                pendingLabel="Removing…"
                ariaLabel={`Remove listing ${tool.name}`}
                question="Pending requests will be declined."
                confirmLabel="Yes, remove"
                onConfirm={() => removeTool({ toolId: tool._id })}
              />
            </li>
          ))}
        </RowList>
      )}
      <Pagination pager={pager} label="listings" />
    </div>
  );
}
