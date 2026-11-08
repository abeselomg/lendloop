"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CATEGORIES, type Category } from "@convex/lib/validation";
import { CATEGORY_LABELS } from "@/lib/labels";
import { CategoryIcon } from "@/components/CategoryIcon";

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

function Tag({ name, category, tilt }: { name: string; category: Category; tilt: string }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-xl border border-line bg-surface px-4 pb-4 pt-8 shadow-[0_1px_0_rgb(0_0_0/0.04),0_6px_14px_-8px_rgb(0_0_0/0.25)] tag-sway ${tilt}`}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-3 size-3 -translate-x-1/2 rounded-full border border-peg-edge bg-peg-hole shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]"
      />
      <CategoryIcon category={category} className="size-7 text-accent" />
      <p className="mt-3 font-display text-[1.05rem] font-semibold leading-snug text-ink">{name}</p>
      <p className="mt-1 text-xs text-muted">{CATEGORY_LABELS[category]}</p>
    </div>
  );
}

export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);
  const [filter, setFilter] = useState<Category | "all">("all");

  const counts = useMemo(() => {
    const c = new Map<Category, number>();
    for (const t of tools ?? []) c.set(t.category, (c.get(t.category) ?? 0) + 1);
    return c;
  }, [tools]);

  const heading = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <h2 className="font-display text-2xl font-semibold tracking-tight">On the board now</h2>
      {tools !== undefined && tools.length > 0 ? (
        <p className="text-sm text-muted" aria-live="polite">
          {tools.length} {tools.length === 1 ? "tool" : "tools"} free to borrow
        </p>
      ) : null}
    </div>
  );

  if (tools === undefined) {
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

  if (tools.length === 0) {
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

  const present = CATEGORIES.filter((c) => counts.has(c));
  const shown = filter === "all" ? tools : tools.filter((t) => t.category === filter);
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
      active
        ? "border-accent bg-accent text-accent-ink"
        : "border-line bg-surface text-ink hover:border-accent/50"
    }`;

  return (
    <section>
      {heading}
      <div role="group" aria-label="Filter by category" className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>
          All <span className="opacity-70">{tools.length}</span>
        </button>
        {present.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={filter === c}
            onClick={() => setFilter(c)}
            className={chip(filter === c)}
          >
            {CATEGORY_LABELS[c]} <span className="opacity-70">{counts.get(c)}</span>
          </button>
        ))}
      </div>
      <Pegboard label="Tools available to borrow">
        {/* Keyed on the filter so the tags drop back onto the board each time it changes. */}
        <ul key={filter} className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((t, i) => (
            <li key={t._id} className="tag-drop" style={{ "--d": `${Math.min(i, 11) * 55}ms` } as CSSProperties}>
              <Tag name={t.name} category={t.category} tilt={TILTS[i % TILTS.length]} />
            </li>
          ))}
        </ul>
      </Pegboard>
    </section>
  );
}
