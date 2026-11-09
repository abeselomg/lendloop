// 24x24 line icons, one per icon key (see CATEGORY_ICONS). Unknown keys render the "other" box. Decorative: the category name is always shown as text next to them.
const PATHS: Record<string, React.ReactNode> = {
  power_tools: (
    <>
      <path d="M3 6.5h10.5a2.5 2.5 0 0 1 2.5 2.5v.5a2.5 2.5 0 0 1-2.5 2.5H9" />
      <path d="M16 8.5h3.5M19.5 7.5v2" />
      <path d="M9 12l-1.4 7.5h3.3L12 12" />
      <path d="M5.5 6.5V12" />
    </>
  ),
  hand_tools: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  garden: (
    <>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </>
  ),
  kitchen: (
    <>
      <path d="M4 10h16v6.5a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5z" />
      <path d="M2 10h2M20 10h2" />
      <path d="M9 7h6M12 4.5V7" />
    </>
  ),
  camping: (
    <>
      <path d="M3.5 20 13 4" />
      <path d="M20.5 20 11 4" />
      <path d="M15 20l-3-5.5L9 20" />
      <path d="M2 20h20" />
    </>
  ),
  cleaning: (
    <>
      <path d="M8 10h6l1 3v6.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5V13z" />
      <path d="M9 10V6.5h4V10" />
      <path d="M13 6.5h3.5l1 1.5" />
      <path d="M19.5 4h.01M21 6.5h.01M19.5 9h.01" />
    </>
  ),
  automotive: (
    <>
      <path d="M5 17H3v-5l2.2-5h13.6L21 12v5h-2" />
      <path d="M9 17h6M3 12h18" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  other: (
    <>
      <path d="M21 8 12 3 3 8l9 5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
};

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[icon] ?? PATHS.other}
    </svg>
  );
}
