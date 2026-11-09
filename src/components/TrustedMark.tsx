/** Shield mark; "Trusted lender" shows on hover and keyboard focus, and is read out by screen readers. */
export function TrustedMark() {
  return (
    <span
      tabIndex={0}
      role="img"
      aria-label="Trusted lender"
      className="group relative inline-flex shrink-0 align-middle text-accent outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5 2.5 3.8v3.7c0 3.2 2.3 5.8 5.5 7 3.2-1.2 5.5-3.8 5.5-7V3.8z" />
        <path d="m5.6 8 1.7 1.7 3.2-3.4" />
      </svg>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-bg opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Trusted lender
      </span>
    </span>
  );
}
