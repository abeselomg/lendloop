"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

/** Labelled search field. `onChange` fires 250 ms after typing stops, and immediately on clear. */
export function SearchInput({
  label,
  onChange,
  placeholder,
  defaultValue = "",
  className = "",
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(defaultValue);
  const debounced = useDebouncedValue(text, 250);
  const emitted = useRef(defaultValue);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (debounced === emitted.current) return;
    emitted.current = debounced;
    onChangeRef.current(debounced);
  }, [debounced]);

  const clear = () => {
    setText("");
    emitted.current = "";
    onChange("");
  };

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id={id}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full appearance-none rounded-full border border-line bg-surface py-2 pl-10 pr-10 text-sm placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
