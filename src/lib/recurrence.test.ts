import { describe, it, expect } from "vitest";
import { describeRule, formatRule, generateOccurrences, parseRule } from "./recurrence";

describe("parseRule / formatRule", () => {
  it("round-trips a rule", () => {
    const encoded = formatRule("weekly", "2026-10-28");
    expect(encoded).toBe("weekly;until=2026-10-28");
    expect(parseRule(encoded)).toEqual({ freq: "weekly", until: "2026-10-28" });
  });

  it("returns null for empty or malformed strings", () => {
    expect(parseRule("")).toBeNull();
    expect(parseRule(null)).toBeNull();
    expect(parseRule("weekly")).toBeNull();
    expect(parseRule("bogus;until=2026-10-28")).toBeNull();
    expect(parseRule("weekly;until=not-a-date")).toBeNull();
  });
});

describe("generateOccurrences", () => {
  it("weekly from a Wednesday", () => {
    const dates = generateOccurrences("2026-04-29", "weekly", "2026-05-20");
    expect(dates).toEqual(["2026-04-29", "2026-05-06", "2026-05-13", "2026-05-20"]);
  });

  it("biweekly from a Wednesday", () => {
    const dates = generateOccurrences("2026-04-29", "biweekly", "2026-06-30");
    expect(dates).toEqual(["2026-04-29", "2026-05-13", "2026-05-27", "2026-06-10", "2026-06-24"]);
  });

  it("monthly by weekday — 2nd Monday", () => {
    // 2026-05-11 is the 2nd Monday of May 2026
    const dates = generateOccurrences("2026-05-11", "monthly_by_weekday", "2026-09-30");
    expect(dates).toEqual(["2026-05-11", "2026-06-08", "2026-07-13", "2026-08-10", "2026-09-14"]);
  });

  it("monthly by weekday — skips months without a 5th weekday", () => {
    // 2026-01-29 is the 5th Thursday of January 2026
    const dates = generateOccurrences("2026-01-29", "monthly_by_weekday", "2026-12-31");
    // Only months with a 5th Thursday should be included
    // Jan 2026 (29), Apr 2026 (30), Jul 2026 (30), Oct 2026 (29), Dec 2026 (31)
    expect(dates).toEqual(["2026-01-29", "2026-04-30", "2026-07-30", "2026-10-29", "2026-12-31"]);
  });

  it("respects cap", () => {
    const dates = generateOccurrences("2026-01-01", "weekly", "2030-01-01", 5);
    expect(dates).toHaveLength(5);
  });

  it("returns empty when until < start", () => {
    expect(generateOccurrences("2026-05-01", "weekly", "2026-04-01")).toEqual([]);
  });

  it("returns single date when until === start", () => {
    expect(generateOccurrences("2026-05-01", "weekly", "2026-05-01")).toEqual(["2026-05-01"]);
  });
});

describe("describeRule", () => {
  it("weekly", () => {
    expect(describeRule("2026-04-29", "weekly")).toBe("every Wednesday");
  });
  it("biweekly", () => {
    expect(describeRule("2026-04-29", "biweekly")).toBe("every 2 weeks on Wednesday");
  });
  it("monthly by weekday", () => {
    expect(describeRule("2026-05-11", "monthly_by_weekday")).toBe("2nd Monday of each month");
  });
});
