import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import { SignInButton, Show } from "@clerk/nextjs";
import { PublicToolList } from "@/components/PublicToolList";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const ctaClass =
  "inline-flex items-center rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-ink shadow-[0_6px_16px_-8px_var(--color-accent)] transition-opacity hover:opacity-90";

const STEPS = [
  {
    title: "Hang up a tool",
    body: "List something you're happy to lend, with its condition and a short note.",
  },
  {
    title: "Ask for dates",
    body: "Pick the days you need it. The owner is notified straight away.",
  },
  {
    title: "Pick it up, bring it back",
    body: "Once they approve, arrange the handover and return it when you're done.",
  },
];

export default function Home() {
  return (
    <div className={`${display.variable} flex flex-1 flex-col`}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl font-bold tracking-tight text-accent">
          LendLoop
        </span>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-ink hover:text-accent"
            >
              Sign in
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/browse"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink hover:text-accent"
          >
            Open your board
          </Link>
        </Show>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20">
        <section className="pb-14 pt-8 md:pt-14">
          <h1 className="font-display text-[clamp(2.5rem,7.4vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
            <span className="block text-balance">Borrow what you need.</span>
            <span className="block text-balance">
              Lend what you don&apos;t.
            </span>
          </h1>
          <div className="mt-10 grid gap-10 md:grid-cols-[1.25fr_1fr] md:gap-16">
            <div>
              <p className="max-w-[34rem] text-lg leading-relaxed text-muted">
                A lending board for your neighborhood. Borrow a ladder for the
                weekend from someone on your street, and put the drill you use
                twice a year to work.
              </p>
              <div className="mt-8">
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
            </div>

            <div className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="font-display text-lg font-semibold">
                How borrowing works
              </h2>
              <ol className="mt-4 space-y-4">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-semibold text-accent"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{s.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <PublicToolList />

        <p className="mt-6 text-sm text-muted">
          Tools on loan right now are hidden. Sign in to see who&apos;s lending,
          check condition and request dates.
        </p>
      </main>
    </div>
  );
}
