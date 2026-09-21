import { describe, expect, it } from "vitest";
import { workweekRange, zonedTimeToUtc } from "@/lib/time";

describe("zonedTimeToUtc", () => {
  it("converts an EDT (summer) wall-clock time to UTC", () => {
    // Sep 21 2026 is DST (EDT, UTC-4) in America/New_York.
    const utc = zonedTimeToUtc("2026-09-21", "08:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-09-21T12:00:00.000Z");
  });

  it("converts an EST (winter) wall-clock time to UTC", () => {
    // Jan 15 2026 is standard time (EST, UTC-5) in America/New_York.
    const utc = zonedTimeToUtc("2026-01-15", "08:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-01-15T13:00:00.000Z");
  });

  it("round-trips across the spring-forward DST boundary", () => {
    // Clocks spring forward at 2am -> 3am on 2026-03-08 in America/New_York.
    const beforeShift = zonedTimeToUtc("2026-03-07", "12:00", "America/New_York");
    const afterShift = zonedTimeToUtc("2026-03-09", "12:00", "America/New_York");
    // Only 23 hours of wall-clock elapse in real UTC time across the jump,
    // even though it's "2 days" of calendar dates.
    const diffHours = (afterShift.getTime() - beforeShift.getTime()) / 3600000;
    expect(diffHours).toBe(47);
  });
});

describe("workweekRange", () => {
  it("defaults to a Monday-start week", () => {
    // 2026-09-24 is a Thursday.
    const { start, end } = workweekRange("2026-09-24", 1);
    expect(start).toBe("2026-09-21"); // Monday
    expect(end).toBe("2026-09-27"); // Sunday
  });

  it("supports a non-Monday week start", () => {
    // week_start_day = 3 (Wednesday)
    const { start, end } = workweekRange("2026-09-24", 3);
    expect(start).toBe("2026-09-23"); // Wednesday
    expect(end).toBe("2026-09-29"); // Tuesday
  });
});
