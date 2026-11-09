import { describe, expect, it } from "vitest";
import { iconFor, labelFor, type CategoryRow } from "./categories";

const rows: CategoryRow[] = [
  { _id: "1", slug: "garden", label: "Garden & yard", icon: "garden", active: true, order: 10, toolCount: 2 },
  { _id: "2", slug: "bikes", label: "Bikes", icon: "automotive", active: false, order: 20, toolCount: 0 },
];

describe("category lookups", () => {
  it("returns label and icon of a known slug, including archived ones", () => {
    expect(labelFor(rows, "bikes")).toBe("Bikes");
    expect(iconFor(rows, "bikes")).toBe("automotive");
  });
  it("falls back to the slug and the other icon", () => {
    expect(labelFor(rows, "mystery")).toBe("mystery");
    expect(iconFor(rows, "mystery")).toBe("other");
  });
  it("falls back while categories are still loading", () => {
    expect(labelFor([], "garden")).toBe("garden");
  });
});
