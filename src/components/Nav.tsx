"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

const LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "My requests" },
  { href: "/incoming", label: "Incoming" },
];

export function Nav() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const links =
    me?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-accent">
          LendLoop
        </Link>
        <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <UserButton />
      </div>
    </header>
  );
}
