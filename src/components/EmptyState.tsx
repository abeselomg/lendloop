import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
