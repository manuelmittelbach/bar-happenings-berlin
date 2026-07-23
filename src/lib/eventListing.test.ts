import { describe, it, expect } from "vitest";
import {
  isShowable,
  daySlot,
  compareByStartTime,
  compareChronological,
} from "./eventListing";

// Minimal event shapes — the module only reads date/startTime/endTime/status.
const ev = (over: Partial<{
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}>) => ({ date: "2026-07-23", startTime: "20:00", ...over });

describe("isShowable", () => {
  it("shows a live event well before its cutoff", () => {
    const now = new Date(2026, 6, 23, 21, 0); // 21:00, event 20:00–02:00 style
    expect(isShowable(ev({ startTime: "20:00", endTime: "23:00" }), now)).toBe(true);
  });

  it("hides a canceled event even while it is still on", () => {
    const now = new Date(2026, 6, 23, 21, 0);
    expect(
      isShowable(ev({ startTime: "20:00", endTime: "23:00", status: "canceled" }), now),
    ).toBe(false);
  });

  it("keeps a cross-midnight event online after midnight (endTime < startTime)", () => {
    // Event 22:00–02:00 on the 23rd; at 01:00 on the 24th it is still running.
    const now = new Date(2026, 6, 24, 1, 0);
    expect(isShowable(ev({ startTime: "22:00", endTime: "02:00" }), now)).toBe(true);
  });

  it("drops a cross-midnight event once its next-day endTime passes", () => {
    const now = new Date(2026, 6, 24, 3, 0); // past 02:00
    expect(isShowable(ev({ startTime: "22:00", endTime: "02:00" }), now)).toBe(false);
  });

  it("falls off at 22:00 when the start time is unknown", () => {
    const before = new Date(2026, 6, 23, 21, 59);
    const after = new Date(2026, 6, 23, 22, 1);
    expect(isShowable(ev({ startTime: "", endTime: "" }), before)).toBe(true);
    expect(isShowable(ev({ startTime: "", endTime: "" }), after)).toBe(false);
  });
});

describe("daySlot", () => {
  // now = 2026-07-23 12:00 Berlin → today 07-23, tomorrow 07-24, cutoff 08-06.
  const now = new Date("2026-07-23T12:00:00+02:00");

  it("buckets by date relative to now", () => {
    expect(daySlot({ date: "2026-07-22" }, now)).toBe("past");
    expect(daySlot({ date: "2026-07-23" }, now)).toBe("today");
    expect(daySlot({ date: "2026-07-24" }, now)).toBe("tomorrow");
    expect(daySlot({ date: "2026-07-30" }, now)).toBe("upcoming");
  });

  it("puts the horizon day in upcoming and the day after in beyond", () => {
    expect(daySlot({ date: "2026-08-06" }, now)).toBe("upcoming"); // today+14
    expect(daySlot({ date: "2026-08-07" }, now)).toBe("beyond");
  });
});

describe("compareByStartTime", () => {
  it("orders earliest start first", () => {
    expect(
      compareByStartTime({ startTime: "19:00" }, { startTime: "21:00" }),
    ).toBeLessThan(0);
  });

  it("sinks events with no start time to the end", () => {
    expect(
      compareByStartTime({ startTime: "" }, { startTime: "23:30" }),
    ).toBeGreaterThan(0);
  });
});

describe("compareChronological", () => {
  it("orders by date first", () => {
    expect(
      compareChronological(
        { date: "2026-07-24", startTime: "18:00" },
        { date: "2026-07-23", startTime: "23:00" },
      ),
    ).toBeGreaterThan(0);
  });

  it("falls back to start time within the same day, timeless last", () => {
    expect(
      compareChronological(
        { date: "2026-07-23", startTime: "20:00" },
        { date: "2026-07-23", startTime: "" },
      ),
    ).toBeLessThan(0);
  });
});
