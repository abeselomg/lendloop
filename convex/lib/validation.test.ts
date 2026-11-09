import { describe, expect, it } from "vitest";
import {
  daysBetween,
  displayFirstName,
  isIsoDate,
  rangesOverlap,
  todayUtc,
  validateDateRange,
  validateToolInput,
  slugifyCategory,
  validateCategoryLabel,
  DEFAULT_CATEGORIES,
} from "./validation";

const okTool = { name: "Drill", category: "power_tools", condition: "good", description: "Cordless" };

describe("validation", () => {
  it("todayUtc formats UTC date", () =>
    expect(todayUtc(Date.UTC(2026, 10, 7, 23, 59))).toBe("2026-11-07"));
  it("isIsoDate rejects 2026-02-30 and 2026-1-5", () => {
    expect(isIsoDate("2026-11-07")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
  it("daysBetween across month boundary", () =>
    expect(daysBetween("2026-11-28", "2026-12-02")).toBe(4));
  it("rangesOverlap is inclusive on touching days", () => {
    expect(rangesOverlap("2026-11-01", "2026-11-05", "2026-11-05", "2026-11-09")).toBe(true);
    expect(rangesOverlap("2026-11-01", "2026-11-04", "2026-11-05", "2026-11-09")).toBe(false);
  });
  it("validateDateRange accepts start === today", () =>
    expect(validateDateRange("2026-11-07", "2026-11-10", "2026-11-07")).toBeNull());
  it("validateDateRange rejects start in past, end before start, > 30 days, bad format", () => {
    expect(validateDateRange("2026-11-06", "2026-11-10", "2026-11-07")).toEqual(expect.any(String));
    expect(validateDateRange("2026-11-10", "2026-11-09", "2026-11-07")).toEqual(expect.any(String));
    expect(validateDateRange("2026-11-07", "2026-12-08", "2026-11-07")).toEqual(expect.any(String));
    expect(validateDateRange("2026-11-7", "2026-11-10", "2026-11-07")).toEqual(expect.any(String));
    expect(validateDateRange("2026-11-07", "2026-12-07", "2026-11-07")).toBeNull();
  });
  it("validateToolInput enforces name 2–60, description ≤ 300, enum membership", () => {
    expect(validateToolInput(okTool)).toBeNull();
    expect(validateToolInput({ ...okTool, name: "A" })).toEqual(expect.any(String));
    expect(validateToolInput({ ...okTool, name: "x".repeat(61) })).toEqual(expect.any(String));
    expect(validateToolInput({ ...okTool, name: " A " })).toEqual(expect.any(String));
    expect(validateToolInput({ ...okTool, description: "x".repeat(301) })).toEqual(expect.any(String));
    expect(validateToolInput({ ...okTool, description: "x".repeat(300) })).toBeNull();
    expect(validateToolInput({ ...okTool, category: " " })).toEqual(expect.any(String));
    expect(validateToolInput({ ...okTool, condition: "bogus" })).toEqual(expect.any(String));
  });
});

describe("displayFirstName", () => {
  it("uses the first word of the name when present", () => {
    expect(displayFirstName({ name: "  Alice Smith ", email: "a+x@e.test" })).toBe("Alice");
  });
  it("falls back to the email local part without a +tag, never the full email", () => {
    expect(displayFirstName({ email: "bob@example.com" })).toBe("bob");
    expect(displayFirstName({ email: "bob+clerk_test@example.com" })).toBe("bob");
    expect(displayFirstName({ name: "", email: "ada+x@e.test" })).toBe("ada");
  });
  it("keeps the local part when stripping the tag would leave nothing", () => {
    expect(displayFirstName({ email: "+x@e.test" })).toBe("+x");
  });

  it("slugifyCategory lowercases and collapses non-alphanumerics to _", () => {
    expect(slugifyCategory("  Power Tools! ")).toBe("power_tools");
    expect(slugifyCategory("Caf\u00e9 & Bar")).toBe("caf_bar");
    expect(slugifyCategory("!!!")).toBe("");
  });
  it("validateCategoryLabel enforces 2-30 chars and a usable slug", () => {
    expect(validateCategoryLabel("Toys")).toBeNull();
    expect(validateCategoryLabel("A")).toEqual(expect.any(String));
    expect(validateCategoryLabel("x".repeat(31))).toEqual(expect.any(String));
    expect(validateCategoryLabel("!!")).toEqual(expect.any(String));
  });
  it("DEFAULT_CATEGORIES slugs match their slugified labels", () => {
    for (const c of DEFAULT_CATEGORIES) expect(slugifyCategory(c.label)).toBe(c.slug);
  });
});
