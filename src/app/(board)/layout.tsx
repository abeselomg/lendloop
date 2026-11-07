import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </>
  );
}
