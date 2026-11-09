"use client";

import { useId } from "react";
import { CATEGORY_ICONS } from "@convex/lib/validation";
import { CategoryIcon } from "@/components/CategoryIcon";

const ICON_NAMES: Record<string, string> = {
  power_tools: "Power tools",
  hand_tools: "Hand tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  cleaning: "Cleaning",
  automotive: "Automotive",
  other: "Other",
};

/** Radio group of the available category icons. */
export function IconPicker({
  value,
  onChange,
  legend,
  disabled,
}: {
  value: string;
  onChange: (icon: string) => void;
  legend: string;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-sm text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_ICONS.map((icon) => (
          <label key={icon} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={icon}
              checked={value === icon}
              onChange={() => onChange(icon)}
              className="peer sr-only"
            />
            <span
              title={ICON_NAMES[icon] ?? icon}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-accent peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            >
              <CategoryIcon icon={icon} className="h-5 w-5" />
              <span className="sr-only">{ICON_NAMES[icon] ?? icon}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
