"use client";

import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type TabItem = { id: string; label: string; count?: number };

/**
 * WAI-ARIA tabs with automatic activation: arrow keys move focus and select. `children` is the active panel.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  children,
  label,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  children: ReactNode;
  label?: string;
}) {
  const baseId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const select = (id: string) => {
    onChange(id);
    refs.current[id]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id);
  };

  // Fall back to the first tab so exactly one tab is always in the tab order.
  const current = tabs.some((t) => t.id === value) ? value : tabs[0]?.id;

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line pb-3">
        {tabs.map((t, i) => {
          const active = t.id === current;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={active}
              aria-controls={panelId(t.id)}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.count !== undefined ? (
                <span className="text-xs tabular-nums opacity-80">{t.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {current ? (
        <div role="tabpanel" id={panelId(current)} aria-labelledby={tabId(current)} tabIndex={0} className="pt-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Keeps the active tab in the URL (`?tab=`) so it is linkable and survives refresh.
 * Uses useSearchParams, so the component calling it must sit under a <Suspense> boundary.
 */
export function useTabParam(key: string, defaultValue: string): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultValue) params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, key, defaultValue],
  );

  return [value, setValue];
}
