// The hero illustration: an example loan written on a kraft luggage tag, hung from a peg by a loop of string.
const ROWS = [
  { term: "Lent by", detail: "Maya, trusted lender" },
  { term: "Borrowed by", detail: "Sam, three doors down" },
  { term: "Dates", detail: "Sat 14 to Mon 16 Nov" },
];

export function HeroTag() {
  return (
    <figure
      role="img"
      aria-label="Example loan tag: a cordless drill lent by Maya to Sam from Saturday 14 to Monday 16 November, approved."
      className="relative mx-auto w-[min(100%,18rem)]"
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-0 z-10 size-4 -translate-x-1/2 rounded-full bg-muted shadow-[inset_0_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.25)]"
      />
      <div className="hero-tag-swing origin-[50%_0.5rem]" aria-hidden="true">
        <svg viewBox="0 0 60 96" className="mx-auto block h-24 w-[60px] text-kraft-line" fill="none">
          <path
            d="M30 8 C 16 34, 20 76, 30 92 M30 8 C 44 34, 40 76, 30 92"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div className="-mt-4 [filter:drop-shadow(0_14px_18px_rgb(0_0_0/0.18))]">
          <div className="relative bg-kraft px-6 pb-7 pt-12 text-kraft-ink [clip-path:polygon(20%_0,80%_0,100%_11%,100%_100%,0_100%,0_11%)]">
            <span className="absolute left-1/2 top-4 size-5 -translate-x-1/2 rounded-full bg-bg ring-[5px] ring-kraft-line/70" />
            <p className="font-display text-[1.7rem] font-bold leading-tight tracking-tight">Cordless drill</p>
            <p className="mt-0.5 text-sm opacity-75">Power tools, good condition</p>
            <dl className="mt-5 space-y-3">
              {ROWS.map((r) => (
                <div key={r.term} className="border-b border-dashed border-kraft-line pb-2">
                  <dt className="text-xs opacity-70">{r.term}</dt>
                  <dd className="font-medium">{r.detail}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex justify-end">
              <span className="stamp-in -rotate-[9deg] rounded-md border-[3px] border-double border-accent px-3 py-0.5 font-display text-xl font-bold tracking-tight text-accent">
                Approved
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
