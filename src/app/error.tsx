"use client";

import { ConvexError } from "convex/values";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const detail = error instanceof ConvexError && typeof error.data === "string" ? error.data : null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      {detail ? <p className="text-sm text-muted">{detail}</p> : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
