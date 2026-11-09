"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Nav } from "@/components/Nav";
import { PageSkeleton } from "@/components/Skeleton";

export default function BoardLayout({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  const pathname = usePathname();
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {me === undefined || me === null ? (
          // null: signed in but the account row is still being created (UserSync)
          <PageSkeleton label={me === null ? "Setting up your account" : "Loading"} pathname={pathname} />
        ) : (
          children
        )}
      </main>
    </>
  );
}
