// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatDateRange, formatDay, relativeTime } from "./labels";

describe("relativeTime", () => {
  const now = 1_800_000_000_000;
  it("says just now under a minute", () => {
    expect(relativeTime(now - 30_000, now)).toBe("just now");
  });
  it("handles minutes", () => {
    expect(relativeTime(now - 60_000, now)).toBe("1 minute ago");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
  });
  it("handles hours", () => {
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe("2 hours ago");
  });
  it("handles days", () => {
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2 days ago");
  });
  it("handles weeks", () => {
    expect(relativeTime(now - 7 * 86_400_000, now)).toBe("1 week ago");
    expect(relativeTime(now - 21 * 86_400_000, now)).toBe("3 weeks ago");
  });
});

describe("formatDateRange", () => {
  it("same month", () => {
    expect(formatDateRange("2026-11-10", "2026-11-12")).toBe("10–12 Nov 2026");
  });
  it("cross month", () => {
    expect(formatDateRange("2026-11-28", "2026-12-02")).toBe("28 Nov – 2 Dec 2026");
  });
  it("cross year", () => {
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
  });

  it("formatDay shows the weekday and never shifts the day", () => {
    expect(formatDay("2026-12-01")).toBe("Tue 1 Dec 2026");
    expect(formatDay("2026-11-09")).toBe("Mon 9 Nov 2026");
  });
});
