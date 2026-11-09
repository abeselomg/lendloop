import type { ReactNode } from "react";

// Placeholder shapes shown while Convex data loads. Each region tells screen readers what is loading; the shapes
// themselves are hidden from them. The pulse stops under prefers-reduced-motion (see globals.css).

export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-line ${className}`} />;
}

export function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function ToolCardSkeleton() {
  return (
    <div className="flex w-full flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <Bone className="h-5 w-2/5" />
        <Bone className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3 flex gap-2">
        <Bone className="h-5 w-20 rounded-full" />
        <Bone className="h-5 w-24" />
      </div>
      <Bone className="mt-4 h-4 w-full" />
      <Bone className="mt-2 h-4 w-3/4" />
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <Bone className="h-4 w-28" />
        <Bone className="h-8 w-32 rounded-full" />
      </div>
    </div>
  );
}

export function ToolGridSkeleton({ label, count = 6 }: { label: string; count?: number }) {
  return (
    <SkeletonRegion label={label}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex">
            <ToolCardSkeleton />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

function LoanCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="w-1/2">
          <Bone className="h-5 w-40" />
          <Bone className="mt-2 h-4 w-28" />
        </div>
        <Bone className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Bone className="h-3 w-10" />
            <Bone className="mt-1.5 h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <Bone className="h-4 w-64 max-w-full" />
      </div>
      <div className="mt-4 flex justify-end">
        <Bone className="h-9 w-36 rounded-full" />
      </div>
    </div>
  );
}

export function LoanListSkeleton({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <SkeletonRegion label={label}>
      <ul className="space-y-4" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <LoanCardSkeleton />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

export function RowsSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <SkeletonRegion label={label}>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="w-2/3">
              <Bone className="h-4 w-1/2" />
              <Bone className="mt-2 h-3 w-1/3" />
            </div>
            <Bone className="h-8 w-24 rounded-full" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

export function FormSkeleton({ label }: { label: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="max-w-xl space-y-5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Bone className="h-4 w-24" />
            <Bone className="mt-2 h-10 w-full rounded-lg" />
          </div>
        ))}
        <div>
          <Bone className="h-4 w-28" />
          <Bone className="mt-2 h-24 w-full rounded-lg" />
        </div>
        <Bone className="h-10 w-36 rounded-full" />
      </div>
    </SkeletonRegion>
  );
}

/**
 * Whole-page placeholder for when the signed-in user is still loading, shaped like the page being opened so the
 * layout does not jump when the real content arrives.
 */
export function PageSkeleton({ label, pathname = "" }: { label: string; pathname?: string }) {
  const body = /^\/(requests|incoming)/.test(pathname) ? (
    <LoanListSkeleton label={label} />
  ) : /^\/listings\/(new|[^/]+\/edit)/.test(pathname) ? (
    <FormSkeleton label={label} />
  ) : pathname.startsWith("/admin") ? (
    <RowsSkeleton label={label} />
  ) : (
    <ToolGridSkeleton label={label} count={3} />
  );
  return (
    <div>
      <Bone className="h-8 w-48" />
      <div className="mt-6">{body}</div>
    </div>
  );
}
