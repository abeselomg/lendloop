import { describe, expect, it } from "vitest";
import {
  daysBetween,
  isIsoDate,
  rangesOverlap,
  todayUtc,
  validateDateRange,
  validateToolInput,
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
    expect(validateToolInput({ ...okTool, category: "bogus" })).toEqual(expect.any(String));
    expect(validateToolInput({ ...okTool, condition: "bogus" })).toEqual(expect.any(String));
  });
});
