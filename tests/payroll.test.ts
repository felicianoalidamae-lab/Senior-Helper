import { describe, expect, it } from "vitest";
import { calculatePayroll, type PayrollSettings, type RawTimeEntry, type RawLeaveRequest, type RateSchedule } from "@/lib/payroll";
import { zonedTimeToUtc } from "@/lib/time";
import { payPeriodContaining } from "@/lib/pay-period";

function settings(overrides: Partial<PayrollSettings> = {}): PayrollSettings {
  return {
    timezone: "UTC",
    breaksUnpaid: true,
    shiftTargetMinutes: 480,
    workDays: [1, 2, 3, 4, 5],
    paidLeaveTypes: ["sick", "emergency", "vacation"],
    weekStartDay: 1,
    weeklyOtThresholdMinutes: 2400,
    dailyOtThresholdMinutes: null,
    overtimeMultiplierPct: 100,
    ...overrides,
  };
}

function entry(
  employeeId: string,
  clockIn: string,
  clockOut: string | null,
  breaks: { start: string; end: string | null }[] = [],
  extra: Partial<RawTimeEntry> = {}
): RawTimeEntry {
  return {
    id: `${employeeId}-${clockIn}`,
    employeeId,
    clockIn,
    clockOut,
    breaks,
    source: "live",
    ...extra,
  };
}

function rate(employeeId: string, hourlyRateCents: number, effectiveFrom: string): RateSchedule {
  return { employeeId, hourlyRateCents, effectiveFrom };
}

const E = "emp-1";

describe("calculatePayroll: basic day math", () => {
  it("computes a simple day with one break", () => {
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T09:00:00Z", "2026-09-21T17:00:00Z", [{ start: "2026-09-21T12:00:00Z", end: "2026-09-21T12:30:00Z" }])],
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });

    expect(result.details).toHaveLength(1);
    const row = result.details[0]!;
    expect(row.regularMinutes).toBe(450); // 8h - 30min break
    expect(row.overtimeMinutes).toBe(0);
    expect(row.totalCents).toBe(15000); // 450 * $20/60 = $150.00
    expect(result.summaries[0]!.flags.incomplete).toBe(false);
  });

  it("subtracts multiple breaks in one day", () => {
    const result = calculatePayroll({
      entries: [
        entry(E, "2026-09-21T09:00:00Z", "2026-09-21T17:00:00Z", [
          { start: "2026-09-21T10:30:00Z", end: "2026-09-21T10:45:00Z" },
          { start: "2026-09-21T12:30:00Z", end: "2026-09-21T13:00:00Z" },
          { start: "2026-09-21T15:00:00Z", end: "2026-09-21T15:10:00Z" },
        ]),
      ],
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });

    // 480 total - (15+30+10)=55 break minutes = 425
    expect(result.details[0]!.regularMinutes).toBe(425);
  });

  it("excludes an open entry from pay and flags it incomplete", () => {
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T09:00:00Z", null)],
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });

    expect(result.details[0]!.regularMinutes).toBe(0);
    expect(result.details[0]!.totalCents).toBe(0);
    expect(result.details[0]!.incomplete).toBe(true);
    expect(result.summaries[0]!.flags.incomplete).toBe(true);
  });

  it("attributes an entry crossing midnight entirely to the start date", () => {
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T23:00:00Z", "2026-09-22T02:00:00Z")],
      leaveRequests: [],
      rates: [rate(E, 3000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-22",
    });

    expect(result.details).toHaveLength(1);
    expect(result.details[0]!.date).toBe("2026-09-21");
    expect(result.details[0]!.regularMinutes).toBe(180); // 3 hours
  });

  it("rounds cents half-up", () => {
    // 7 minutes at $19.99/hr = 7 * 1999 / 60 = 233.2166... -> 233 cents
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T09:00:00Z", "2026-09-21T09:07:00Z")],
      leaveRequests: [],
      rates: [rate(E, 1999, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });
    expect(result.details[0]!.totalCents).toBe(233);
  });
});

describe("calculatePayroll: DST", () => {
  it("computes real elapsed minutes across the spring-forward transition", () => {
    // 2026-03-08: America/New_York clocks jump 2am -> 3am. An overnight
    // shift from 11pm to 7am (wall-clock 8h) is really only 7 real hours.
    const clockIn = zonedTimeToUtc("2026-03-07", "23:00", "America/New_York").toISOString();
    const clockOut = zonedTimeToUtc("2026-03-08", "07:00", "America/New_York").toISOString();

    const result = calculatePayroll({
      entries: [entry(E, clockIn, clockOut)],
      leaveRequests: [],
      rates: [rate(E, 3000, "2020-01-01")],
      settings: settings({ timezone: "America/New_York" }),
      periodStart: "2026-03-07",
      periodEnd: "2026-03-08",
    });

    expect(result.details).toHaveLength(1);
    expect(result.details[0]!.date).toBe("2026-03-07");
    expect(result.details[0]!.regularMinutes).toBe(420); // 7 real hours, not 8
  });
});

describe("calculatePayroll: rates", () => {
  it("uses the rate effective on each day when the rate changes mid-period", () => {
    const result = calculatePayroll({
      entries: [
        entry(E, "2026-09-21T09:00:00Z", "2026-09-21T17:00:00Z"), // before raise
        entry(E, "2026-09-23T09:00:00Z", "2026-09-23T17:00:00Z"), // after raise
      ],
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01"), rate(E, 2500, "2026-09-22")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-23",
    });

    const day1 = result.details.find((d) => d.date === "2026-09-21")!;
    const day2 = result.details.find((d) => d.date === "2026-09-23")!;
    expect(day1.rateCents).toBe(2000);
    expect(day2.rateCents).toBe(2500);
    expect(result.summaries[0]!.flags.rateChanged).toBe(true);
  });

  it("does not flag rateChanged when the rate hasn't changed during the period", () => {
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T09:00:00Z", "2026-09-21T17:00:00Z")],
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });
    expect(result.summaries[0]!.flags.rateChanged).toBe(false);
  });
});

describe("calculatePayroll: leave", () => {
  it("counts only configured work days across a leave range spanning a weekend", () => {
    // Fri 2026-09-25 -> Mon 2026-09-28 (Fri, Sat, Sun, Mon). Work days Mon-Fri.
    const leave: RawLeaveRequest = {
      employeeId: E,
      type: "vacation",
      startDate: "2026-09-25",
      endDate: "2026-09-28",
      status: "approved",
    };
    const result = calculatePayroll({
      entries: [],
      leaveRequests: [leave],
      rates: [rate(E, 2400, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-25",
      periodEnd: "2026-09-28",
    });

    const leaveRows = result.details.filter((d) => d.kind === "leave");
    expect(leaveRows.map((r) => r.date)).toEqual(["2026-09-25", "2026-09-28"]);
    expect(result.summaries[0]!.leaveMinutes).toBe(960); // 2 days * 480
  });

  it("counts both worked and leave pay on a day that has both, and flags it", () => {
    const leave: RawLeaveRequest = {
      employeeId: E,
      type: "sick",
      startDate: "2026-09-21",
      endDate: "2026-09-21",
      status: "approved",
    };
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T09:00:00Z", "2026-09-21T13:00:00Z")],
      leaveRequests: [leave],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });

    expect(result.details.some((d) => d.kind === "worked" && d.date === "2026-09-21")).toBe(true);
    expect(result.details.some((d) => d.kind === "leave" && d.date === "2026-09-21")).toBe(true);
    expect(result.summaries[0]!.flags.workedAndLeaveSameDay).toBe(true);
  });

  it("does not let paid leave hours count toward the weekly overtime threshold", () => {
    // 35 worked hours (Mon-Fri, 7h/day) + 1 paid leave day (8h) = 43h on
    // paper, but leave must never push worked hours into overtime.
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]; // Mon-Thu, 7h each
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T16:00:00Z`));
    const leave: RawLeaveRequest = {
      employeeId: E,
      type: "vacation",
      startDate: "2026-09-25", // Friday
      endDate: "2026-09-25",
      status: "approved",
    };

    const result = calculatePayroll({
      entries,
      leaveRequests: [leave],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });

    expect(result.summaries[0]!.overtimeMinutes).toBe(0);
    expect(result.details.filter((d) => d.kind === "worked").every((d) => d.overtimeMinutes === 0)).toBe(true);
  });
});

describe("calculatePayroll: weekly overtime", () => {
  it("has no overtime at exactly 40 hours", () => {
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]; // Mon-Fri, 8h each = 40h
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T17:00:00Z`));
    const result = calculatePayroll({
      entries,
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });
    expect(result.summaries[0]!.overtimeMinutes).toBe(0);
  });

  it("has exactly one minute of overtime at 40h01m", () => {
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]; // Mon-Thu, 8h each = 32h
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T17:00:00Z`));
    entries.push(entry(E, "2026-09-25T09:00:00Z", "2026-09-25T17:01:00Z")); // Fri: 8h01m
    const result = calculatePayroll({
      entries,
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });
    expect(result.summaries[0]!.overtimeMinutes).toBe(1);
    expect(result.summaries[0]!.regularMinutes).toBe(2400);
  });

  it("matches the spec's worked example: 42h week at $20/hr = $840 at 1.0x", () => {
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]; // Mon-Thu, 8h each = 32h
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T17:00:00Z`));
    entries.push(entry(E, "2026-09-25T09:00:00Z", "2026-09-25T19:00:00Z")); // Fri: 10h
    const result = calculatePayroll({
      entries,
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });
    const s = result.summaries[0]!;
    expect(s.regularMinutes).toBe(2400); // 40h
    expect(s.overtimeMinutes).toBe(120); // 2h
    expect(s.totalCents).toBe(84000); // $840.00
  });

  it("matches the spec's worked example at a 1.5x multiplier: $860", () => {
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"];
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T17:00:00Z`));
    entries.push(entry(E, "2026-09-25T09:00:00Z", "2026-09-25T19:00:00Z"));
    const result = calculatePayroll({
      entries,
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings({ overtimeMultiplierPct: 150 }),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });
    expect(result.summaries[0]!.totalCents).toBe(86000); // $860.00
  });

  it("respects a non-Monday week_start_day", () => {
    // week_start_day = Wednesday. Mon 2026-09-21 and Tue 2026-09-22 belong
    // to the PREVIOUS workweek (Wed 09-16 - Tue 09-22), not the workweek
    // containing Wed 09-23 - Tue 09-29. 5 days at 9h = 45h if grouped into
    // one week (5h OT); but split across the Wed boundary they land in two
    // separate 40h-threshold buckets, so no day trips overtime.
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]; // Mon-Fri
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T18:00:00Z`)); // 9h each
    const result = calculatePayroll({
      entries,
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings({ weekStartDay: 3 }),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });
    // Mon+Tue (18h, prior workweek) and Wed+Thu+Fri (27h, new workweek):
    // neither bucket crosses 40h, so overtime should be 0.
    expect(result.summaries[0]!.overtimeMinutes).toBe(0);
  });
});

describe("calculatePayroll: daily overtime", () => {
  it("applies an optional daily threshold without double-counting minutes", () => {
    const result = calculatePayroll({
      entries: [entry(E, "2026-09-21T09:00:00Z", "2026-09-21T19:00:00Z")], // 10h = 600min
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings({ dailyOtThresholdMinutes: 480 }), // 8h/day
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
    });
    const row = result.details[0]!;
    expect(row.overtimeMinutes).toBe(120); // 2h daily OT
    expect(row.regularMinutes).toBe(480); // 8h
    expect(row.regularMinutes + row.overtimeMinutes).toBe(600); // no double count
  });

  it("uses that day's rate for overtime pay when the rate changes mid-week", () => {
    // Mon-Thu 8h each at $20 (32h, all regular). Friday 10h at $25 (new
    // rate effective Friday): 8h regular + 2h overtime, both at $25.
    const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"];
    const entries = days.map((d) => entry(E, `${d}T09:00:00Z`, `${d}T17:00:00Z`));
    entries.push(entry(E, "2026-09-25T09:00:00Z", "2026-09-25T19:00:00Z"));
    const result = calculatePayroll({
      entries,
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01"), rate(E, 2500, "2026-09-25")],
      settings: settings(),
      periodStart: "2026-09-21",
      periodEnd: "2026-09-25",
    });
    const friday = result.details.find((d) => d.date === "2026-09-25")!;
    expect(friday.overtimeMinutes).toBe(120);
    expect(friday.rateCents).toBe(2500);
    // Friday's cents: 8h*$25 + 2h*$25 (1.0x) = $200 + $50 = $250.00
    expect(friday.totalCents).toBe(25000);
  });
});

describe("calculatePayroll: workweek straddling a pay-period boundary", () => {
  it("computes overtime over the full workweek even when the period cuts it off", () => {
    // Full week Mon-Fri, 9h/day (45h). Report period only covers Thu-Fri;
    // Mon-Wed entries are supplied (as the data layer should) purely to
    // get the running weekly total right, and are NOT expected in output.
    const monWed = ["2026-09-21", "2026-09-22", "2026-09-23"].map((d) => entry(E, `${d}T09:00:00Z`, `${d}T18:00:00Z`));
    const thuFri = ["2026-09-24", "2026-09-25"].map((d) => entry(E, `${d}T09:00:00Z`, `${d}T18:00:00Z`));

    const result = calculatePayroll({
      entries: [...monWed, ...thuFri],
      leaveRequests: [],
      rates: [rate(E, 2000, "2020-01-01")],
      settings: settings(),
      periodStart: "2026-09-24",
      periodEnd: "2026-09-25",
    });

    expect(result.details.map((d) => d.date)).toEqual(["2026-09-24", "2026-09-25"]);
    const thu = result.details.find((d) => d.date === "2026-09-24")!;
    const fri = result.details.find((d) => d.date === "2026-09-25")!;
    // Running regular minutes entering Thu: 3*540=1620. Thu regularAfterDaily=540 -> running=2160 (<2400) -> 0 OT.
    expect(thu.overtimeMinutes).toBe(0);
    // Fri: running=2160+540=2700 -> weeklyOt = 2700-2400=300 (5h), regular=240 (4h).
    expect(fri.overtimeMinutes).toBe(300);
    expect(fri.regularMinutes).toBe(240);
  });
});

describe("pay period boundaries (lib/pay-period)", () => {
  it("derives period boundaries from the anchor date", () => {
    const anchor = "2026-09-08";
    expect(payPeriodContaining("2026-09-08", anchor, 14)).toEqual({ start: "2026-09-08", end: "2026-09-21" });
    expect(payPeriodContaining("2026-09-21", anchor, 14)).toEqual({ start: "2026-09-08", end: "2026-09-21" });
    expect(payPeriodContaining("2026-09-22", anchor, 14)).toEqual({ start: "2026-09-22", end: "2026-10-05" });
    // A date before the anchor still resolves to the correct preceding period.
    expect(payPeriodContaining("2026-09-07", anchor, 14)).toEqual({ start: "2026-08-25", end: "2026-09-07" });
  });
});
