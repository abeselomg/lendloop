"use client";

import type { CSSProperties } from "react";
import { api } from "@convex/_generated/api";
import { useCategories } from "@/lib/hooks/useCategories";
import { usePagedQuery } from "@/lib/hooks/usePagedQuery";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Pagination } from "@/components/ui/Pagination";

// A slight, fixed tilt per position so the tags look hung by hand. Not random, so server and client agree.
const TILTS = ["-rotate-[1.5deg]", "rotate-1", "-rotate-[0.5deg]", "rotate-[1.5deg]", "-rotate-1", "rotate-[0.5deg]"];

function Pegboard({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      aria-label={label}
      className="rounded-3xl border border-peg-edge bg-peg p-5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.06)] sm:p-8 [background-image:radial-gradient(circle,var(--color-peg-hole)_2.5px,transparent_3px)] [background-size:28px_28px] [background-position:14px_14px]"
    >
      {children}
    </div>
  );
}

function Tag({ name, category, tilt }: { name: string; category: string; tilt: string }) {
  const { label, icon } = useCategories();
  return (
    <div
      className={`relative flex h-full flex-col rounded-xl border border-line bg-surface px-4 pb-4 pt-8 shadow-[0_1px_0_rgb(0_0_0/0.04),0_6px_14px_-8px_rgb(0_0_0/0.25)] tag-sway ${tilt}`}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-3 size-3 -translate-x-1/2 rounded-full border border-peg-edge bg-peg-hole shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]"
      />
      <CategoryIcon icon={icon(category)} className="size-7 text-accent" />
      <p className="mt-3 font-display text-[1.05rem] font-semibold leading-snug text-ink">{name}</p>
      <p className="mt-1 text-xs text-muted">{label(category)}</p>
    </div>
  );
}

// No category chips here: the board is paginated, so per-category counts or filters would only describe the
// current page. Visitors who want to filter or search sign in and use Browse.
export function PublicToolList() {
  const pager = usePagedQuery(api.tools.queries.listPublic, {}, { pageSize: 12 });

  const heading = (
    <div className="mb-5">
      <h2 className="font-display text-2xl font-semibold tracking-tight">On the board now</h2>
    </div>
  );

  if (pager.isLoading) {
    return (
      <section aria-busy="true">
        {heading}
        <Pegboard label="Tools available to borrow">
          <p className="sr-only" aria-live="polite">
            Loading the board…
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
            {TILTS.slice(0, 4).map((tilt) => (
              <li key={tilt} className={`h-36 rounded-xl border border-line bg-surface/70 ${tilt}`} />
            ))}
          </ul>
        </Pegboard>
      </section>
    );
  }

  if (pager.items.length === 0 && !pager.hasNext && pager.pageIndex === 0) {
    return (
      <section>
        {heading}
        <Pegboard label="Tools available to borrow">
          <div className="mx-auto max-w-sm rounded-xl border border-line bg-surface px-6 py-10 text-center">
            <p className="font-display text-lg font-semibold">The board is empty</p>
            <p className="mt-1.5 text-sm text-muted">Sign in and hang up the first tool for your neighbors.</p>
          </div>
        </Pegboard>
      </section>
    );
  }

  return (
    <section>
      {heading}
      <Pegboard label="Tools available to borrow">
        {/* Keyed on the page so the tags drop back onto the board each time it changes. */}
        <ul
          key={pager.pageIndex}
          className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4"
        >
          {pager.items.map((t, i) => (
            <li key={t._id} className="tag-drop" style={{ "--d": `${Math.min(i, 11) * 55}ms` } as CSSProperties}>
              <Tag name={t.name} category={t.category} tilt={TILTS[i % TILTS.length]} />
            </li>
          ))}
        </ul>
      </Pegboard>
      <Pagination pager={pager} label="tools" />
    </section>
  );
}
