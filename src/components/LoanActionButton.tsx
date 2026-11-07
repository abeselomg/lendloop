"use client";

import { useState } from "react";
import { ConvexError } from "convex/values";

const STYLES = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line hover:border-accent",
} as const;

export function LoanActionButton({
  label,
  pendingLabel,
  ariaLabel,
  variant,
  confirmText,
  run,
}: {
  label: string;
  pendingLabel: string;
  ariaLabel: string;
  variant: keyof typeof STYLES;
  confirmText?: string;
  run: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setBusy(true);
    try {
      await run();
    } catch (err) {
      setError(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mr-auto text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={busy}
        onClick={onClick}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-60 ${STYLES[variant]}`}
      >
        {busy ? pendingLabel : label}
      </button>
    </>
  );
}
