import { describe, it, expect } from "vitest";
import { describeRule, formatRule, generateOccurrences, parseRule } from "./recurrence";

describe("parseRule / formatRule", () => {
  it("round-trips a bounded rule", () => {
    const encoded = formatRule("weekly", "2026-10-28");
    expect(encoded).toBe("weekly;until=2026-10-28");
    expect(parseRule(encoded)).toEqual({ freq: "weekly", until: "2026-10-28" });
  });

  it("round-trips an indefinite rule (no until)", () => {
    const encoded = formatRule("weekly", null);
    expect(encoded).toBe("weekly");
    expect(parseRule(encoded)).toEqual({ freq: "weekly", until: null });
  });

  it("returns null for empty or malformed strings", () => {
    expect(parseRule("")).toBeNull();
    expect(parseRule(null)).toBeNull();
    expect(parseRule("bogus;until=2026-10-28")).toBeNull();
    expect(parseRule("weekly;until=not-a-date")).toBeNull();
  });
});

describe("generateOccurrences", () => {
  it("weekly from a Wednesday", () => {
    const dates = generateOccurrences("2026-04-29", "weekly", "2026-05-20");
    expect(dates).toEqual(["2026-04-29", "2026-05-06", "2026-05-13", "2026-05-20"]);
  });

  it("biweekly — 2nd Thursday: picks 2nd+4th Thursday each month", () => {
    // 2026-05-14 = 2nd Thursday of May → even group → 2nd and 4th Thursday
    const dates = generateOccurrences("2026-05-14", "biweekly", "2026-07-31");
    expect(dates).toEqual([
      "2026-05-14", "2026-05-28",
      "2026-06-11", "2026-06-25",
      "2026-07-09", "2026-07-23",
    ]);
  });

  it("biweekly — 1st Thursday: picks 1st+3rd Thursday each month", () => {
    // 2026-05-07 = 1st Thursday of May → odd group → 1st and 3rd Thursday
    const dates = generateOccurrences("2026-05-07", "biweekly", "2026-06-30");
    expect(dates).toEqual([
      "2026-05-07", "2026-05-21",
      "2026-06-04", "2026-06-18",
    ]);
  });

  it("biweekly — 5th Wednesday (odd group): picks 1st+3rd+5th when available", () => {
    // 2026-04-29 = 5th Wednesday of April → odd group
    const dates = generateOccurrences("2026-04-29", "biweekly", "2026-06-30");
    // May: 1st=May 6, 3rd=May 20; June: 1st=Jun 3, 3rd=Jun 17
    expect(dates).toEqual(["2026-04-29", "2026-05-06", "2026-05-20", "2026-06-03", "2026-06-17"]);
  });

  it("monthly last weekday — last Thursday", () => {
    // 2026-05-28 = last Thursday of May 2026
    const dates = generateOccurrences("2026-05-28", "monthly_last_weekday", "2026-09-30");
    // Last Thursday: Jun 25, Jul 30, Aug 27, Sep 24
    expect(dates).toEqual(["2026-05-28", "2026-06-25", "2026-07-30", "2026-08-27", "2026-09-24"]);
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
  it("monthly last weekday", () => {
    expect(describeRule("2026-05-28", "monthly_last_weekday")).toBe("last Thursday of each month");
  });
  it("biweekly — odd group", () => {
    // 2026-04-29 = 5th Wednesday (odd) → 1st and 3rd
    expect(describeRule("2026-04-29", "biweekly")).toBe("1st and 3rd Wednesday of each month");
  });
  it("biweekly — even group", () => {
    // 2026-05-14 = 2nd Thursday (even) → 2nd and 4th
    expect(describeRule("2026-05-14", "biweekly")).toBe("2nd and 4th Thursday of each month");
  });
  it("monthly by weekday", () => {
    expect(describeRule("2026-05-11", "monthly_by_weekday")).toBe("2nd Monday of each month");
  });
});
