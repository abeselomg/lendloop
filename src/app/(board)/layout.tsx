"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Nav } from "@/components/Nav";

export default function BoardLayout({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {me === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : me === null ? (
          <p className="text-sm text-muted">Setting up your account…</p>
        ) : (
          children
        )}
      </main>
    </>
  );
}
