import Link from "next/link";
import { SignInButton, Show } from "@clerk/nextjs";
import { PublicToolList } from "@/components/PublicToolList";

const ctaClass =
  "inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-16">
      <header className="mb-14 max-w-xl">
        <h1 className="text-5xl font-semibold tracking-tight text-accent">LendLoop</h1>
        <p className="mt-3 text-xl text-ink">Borrow what you need. Lend what you don&apos;t.</p>
        <div className="mt-7">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className={ctaClass}>
                Sign in to lend or borrow
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link href="/browse" className={ctaClass}>
              Open your board
            </Link>
          </Show>
        </div>
      </header>
      <PublicToolList />
    </main>
  );
}
