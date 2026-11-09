"use client";

import { useState } from "react";
import { useAction as useConvexAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { RowsSkeleton } from "@/components/Skeleton";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { BTN, Empty, InlineError, RowList, useAction } from "./shared";
import { UserRow } from "./UserRow";

type RoleFilter = "all" | "admin" | "user";

const FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admins" },
  { id: "user", label: "Members" },
];

function SyncButton() {
  const sync = useConvexAction(api.users.actions.syncFromClerk);
  const { busy, error, run } = useAction();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setResult(null);
          await run(async () => {
            const r = await sync({});
            setResult(`Synced: ${r.created} new, ${r.updated} updated`);
          });
        }}
        className={BTN}
      >
        {busy ? "Syncing…" : "Sync with Clerk"}
      </button>
      {result ? (
        <p role="status" className="text-sm text-muted">
          {result}
        </p>
      ) : null}
      <InlineError>{error}</InlineError>
    </div>
  );
}

export function UsersTab() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const term = search.trim();
  const pager = usePagedQuery(
    api.users.queries.listAll,
    { ...(term ? { search: term } : {}), ...(role === "all" ? {} : { role }) },
    { pageSize: 10 },
  );
  const filtered = term !== "" || role !== "all";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search by name or email"
          placeholder="Search by name or email"
          onChange={setSearch}
          className="w-full sm:w-72"
        />
        <div role="group" aria-label="Filter by role" className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={role === f.id}
              onClick={() => setRole(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                role === f.id ? "border border-accent bg-accent-soft text-accent" : "border border-line hover:border-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <SyncButton />
        </div>
      </div>
      {pager.isLoading ? (
        <RowsSkeleton label="Loading users" />
      ) : pager.items.length === 0 ? (
        <Empty>{filtered ? "No users match." : "No users yet."}</Empty>
      ) : (
        <RowList label="Users">
          {pager.items.map((u) => (
            <UserRow key={u._id} user={u} />
          ))}
        </RowList>
      )}
      <Pagination pager={pager} label="users" />
    </div>
  );
}
