import { describe, expect, it } from "vitest";
import { dateToIso, isoToDate, nextSelection } from "./dateSelection";

const none = { start: null, end: null };
const booked = [{ startDate: "2026-11-14", endDate: "2026-11-16" }];

describe("dateSelection", () => {
  it("round-trips calendar days without a time zone shift", () => {
    for (const d of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31", "2028-02-29"]) {
      expect(dateToIso(isoToDate(d))).toBe(d);
    }
  });

  it("first click picks the start, second the end", () => {
    const a = nextSelection(none, "2026-11-10", booked);
    expect(a).toEqual({ start: "2026-11-10", end: null });
    expect(nextSelection(a, "2026-11-12", booked)).toEqual({ start: "2026-11-10", end: "2026-11-12" });
  });

  it("clicking the start again makes a one-day loan", () => {
    expect(nextSelection({ start: "2026-11-10", end: null }, "2026-11-10", booked)).toEqual({
      start: "2026-11-10",
      end: "2026-11-10",
    });
  });

  it("a click after a complete range starts over", () => {
    expect(nextSelection({ start: "2026-11-10", end: "2026-11-12" }, "2026-11-20", booked)).toEqual({
      start: "2026-11-20",
      end: null,
    });
  });

  it("a click before the start restarts there", () => {
    expect(nextSelection({ start: "2026-11-10", end: null }, "2026-11-08", booked)).toEqual({
      start: "2026-11-08",
      end: null,
    });
  });

  it("a range across booked days restarts at the clicked day", () => {
    expect(nextSelection({ start: "2026-11-12", end: null }, "2026-11-18", booked)).toEqual({
      start: "2026-11-18",
      end: null,
    });
    expect(nextSelection({ start: "2026-11-17", end: null }, "2026-11-18", booked)).toEqual({
      start: "2026-11-17",
      end: "2026-11-18",
    });
  });
});
