"use client";

import { useState, type ReactNode } from "react";
import { ConvexError } from "convex/values";

export function errorMessage(err: unknown): string {
  return err instanceof ConvexError && typeof err.data === "string" ? err.data : "Something went wrong";
}

/** Runs a mutation with a pending flag and an inline error message. Resolves true on success. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const BTN = `rounded-full border border-line px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent ${FOCUS} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-inherit`;
export const BTN_PRIMARY = `rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 ${FOCUS} disabled:cursor-not-allowed disabled:opacity-50`;
export const BTN_DANGER = `rounded-full border border-red-300 px-3.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 ${FOCUS} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10`;
export const INPUT = `rounded-lg border border-line bg-surface px-3 py-1.5 text-sm ${FOCUS}`;

export function RowList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {children}
    </ul>
  );
}

export function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>
  );
}

export function InlineError({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {children}
    </p>
  );
}

/** Two-step button: the first click asks inline, the second runs the action. */
export function ConfirmButton({
  label,
  pendingLabel,
  ariaLabel,
  question,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  ariaLabel: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const { busy, error, run } = useAction();

  if (!asking) {
    return (
      <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={() => setAsking(true)} className={BTN_DANGER}>
        {label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      <InlineError>{error}</InlineError>
      <span className="text-sm text-muted">{question}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (await run(onConfirm)) setAsking(false);
        }}
        className={BTN_DANGER}
      >
        {busy ? pendingLabel : confirmLabel}
      </button>
      <button type="button" disabled={busy} onClick={() => setAsking(false)} className={BTN}>
        Cancel
      </button>
    </div>
  );
}
