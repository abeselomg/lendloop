import type { CSSProperties } from "react";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import { SignInButton, Show } from "@clerk/nextjs";
import { PublicToolList } from "@/components/PublicToolList";
import { HeroTag } from "@/components/HeroTag";
import { Nav } from "@/components/Nav";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

const ctaClass =
  "inline-flex items-center rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-ink shadow-[0_6px_16px_-8px_var(--color-accent)] transition-opacity hover:opacity-90";
// Stagger for the .rise entrance animation.
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const navLinkClass = "rounded-full px-3 py-1.5 text-sm font-medium text-ink hover:text-accent";

const STEPS = [
  { title: "Hang up a tool", body: "List something you're happy to lend, with its condition and a short note." },
  { title: "Ask for dates", body: "Pick the days you need it. The owner is notified straight away." },
  { title: "Pick it up, bring it back", body: "Once they approve, arrange the handover and return it when you're done." },
];

export default function Home() {
  return (
    <div className={`${display.variable} flex flex-1 flex-col`}>
      {/* Visitors get the marketing header; signed-in neighbours get the same app header as every other page. */}
      <Show when="signed-out">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
          <span className="font-display text-xl font-bold tracking-tight text-accent">LendLoop</span>
          <SignInButton mode="modal">
            <button type="button" className={navLinkClass}>
              Sign in
            </button>
          </SignInButton>
        </header>
      </Show>
      <Show when="signed-in">
        <Nav wide />
      </Show>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20">
        <section className="relative isolate grid items-center gap-14 pb-12 pt-6 md:grid-cols-[1fr_18rem] md:pt-12 lg:gap-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-5 -top-24 bottom-0 -z-10 opacity-60 [background-image:radial-gradient(circle,var(--color-peg-edge)_2px,transparent_2.5px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_75%_40%,black,transparent_75%)]"
          />
          <div>
            <h1 className="font-display text-[clamp(2.5rem,6.2vw,4rem)] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
              <span className="rise block text-balance">Borrow what you need.</span>
              <span className="rise block text-balance" style={delay(90)}>
                Lend what you don&apos;t.
              </span>
            </h1>
            <p className="rise mt-6 max-w-[33rem] text-lg leading-relaxed text-muted" style={delay(200)}>
              A lending board for your neighborhood. Borrow a ladder for the weekend from someone on your street, and
              put the drill you use twice a year to work.
            </p>
            <div className="rise mt-8" style={delay(300)}>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button type="button" className={ctaClass}>
                    Sign in to lend or borrow
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link href="/browse" className={ctaClass}>
                  Browse tools
                </Link>
              </Show>
            </div>
          </div>
          <HeroTag />
        </section>

        <section aria-labelledby="how-it-works" className="mb-16 border-t border-line pt-8">
          <h2 id="how-it-works" className="sr-only">
            How borrowing works
          </h2>
          <ol className="rise grid gap-6 sm:grid-cols-3" style={delay(420)}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30 font-display text-sm font-semibold text-accent"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <PublicToolList />

        <p className="mt-6 text-sm text-muted">
          Tools on loan right now are hidden. Sign in to see who&apos;s lending, check condition and request dates.
        </p>
      </main>
    </div>
  );
}
