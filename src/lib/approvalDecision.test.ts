import { describe, it, expect } from "vitest";
import {
  buildClaimedSlots,
  decideApproval,
  findSameDayClashes,
  MULTI_EVENT_PER_DAY_VENUE_IDS,
} from "./approvalDecision";

type StagedInput = Parameters<typeof decideApproval>[0];

// Minimal confirmed new-event row; each test overrides only what it exercises.
function makeStaged(overrides: Partial<StagedInput> = {}): StagedInput {
  return {
    verifyVerdict: "confirmed",
    replacesEventId: null,
    venueId: "venue-1",
    title: "Jazz Night",
    date: "2026-08-01",
    category: "music",
    ...overrides,
  };
}

const noSlots = () => ({ claimedSlots: new Set<string>() });

describe("decideApproval", () => {
  // 1 — verify gate, applies to new AND update rows
  it("skips when the verdict is not confirmed (new row, never verified)", () => {
    const d = decideApproval(makeStaged({ verifyVerdict: "" }), noSlots());
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("not verified yet — run the verify sweep first");
  });

  it("skips when the verdict is a non-confirmed value (new row)", () => {
    const d = decideApproval(makeStaged({ verifyVerdict: "confirmed_weak" }), noSlots());
    expect(d.action).toBe("skip");
    expect(d.reason).toBe('verify verdict "confirmed_weak" — review manually');
  });

  it("skips an update row too when its verdict is not confirmed (verdict wins over update)", () => {
    const d = decideApproval(
      makeStaged({ replacesEventId: "live-1", verifyVerdict: "not_found" }),
      noSlots(),
    );
    expect(d.action).toBe("skip");
    expect(d.reason).toBe('verify verdict "not_found" — review manually');
  });

  // 2 — confirmed update row
  it("classifies a confirmed update row as update", () => {
    const d = decideApproval(makeStaged({ replacesEventId: "live-1" }), noSlots());
    expect(d.action).toBe("update");
    expect(d.reason).toBeUndefined();
  });

  // 3 — new row, no clash
  it("inserts a confirmed new row when the bar has no event that day", () => {
    const d = decideApproval(makeStaged(), noSlots());
    expect(d.action).toBe("insert");
    expect(d.reason).toBeUndefined();
  });

  // 4 — new row, clash
  it("skips a new row when the bar already has an event that day", () => {
    const d = decideApproval(makeStaged(), {
      claimedSlots: new Set(["venue-1|2026-08-01"]),
    });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("another event already exists in this bar that day");
  });

  // 5 — the bug catcher: clash but bar is whitelisted → still insert
  it("inserts despite a clash when the bar is on the passed whitelist", () => {
    const d = decideApproval(makeStaged(), {
      claimedSlots: new Set(["venue-1|2026-08-01"]),
      whitelist: new Set(["venue-1"]),
    });
    expect(d.action).toBe("insert");
  });

  it("falls back to MULTI_EVENT_PER_DAY_VENUE_IDS when no whitelist is passed", () => {
    const whitelisted = [...MULTI_EVENT_PER_DAY_VENUE_IDS][0];
    const d = decideApproval(
      makeStaged({ venueId: whitelisted }),
      { claimedSlots: new Set([`${whitelisted}|2026-08-01`]) },
    );
    expect(d.action).toBe("insert");
  });

  // 6 — missing required value / no venue
  it("skips a new row with no linked venue", () => {
    const d = decideApproval(makeStaged({ venueId: "" }), noSlots());
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("no venue linked");
  });

  it("skips a new row missing title, date or category", () => {
    expect(decideApproval(makeStaged({ title: "  " }), noSlots()).reason).toBe(
      "missing title, date or category",
    );
    expect(decideApproval(makeStaged({ date: "" }), noSlots()).action).toBe("skip");
    expect(decideApproval(makeStaged({ category: null }), noSlots()).action).toBe("skip");
  });
});

describe("buildClaimedSlots", () => {
  it("keys every live event as venue|date", () => {
    const slots = buildClaimedSlots({
      "venue-1": [{ date: "2026-08-01" }, { date: "2026-08-02" }],
      "venue-2": [{ date: "2026-08-01" }],
    });
    expect(slots).toEqual(
      new Set(["venue-1|2026-08-01", "venue-1|2026-08-02", "venue-2|2026-08-01"]),
    );
  });

  it("collapses two events in the same bar on the same day into one slot", () => {
    const slots = buildClaimedSlots({
      "venue-1": [{ date: "2026-08-01" }, { date: "2026-08-01" }],
    });
    expect(slots.size).toBe(1);
  });

  it("returns an empty set for an empty map", () => {
    expect(buildClaimedSlots({}).size).toBe(0);
  });

  it("produces slots decideApproval reads as a clash", () => {
    const slots = buildClaimedSlots({ "venue-1": [{ date: "2026-08-01" }] });
    expect(decideApproval(makeStaged(), { claimedSlots: slots }).action).toBe("skip");
  });
});

describe("findSameDayClashes", () => {
  const live = [
    { id: "a", date: "2026-08-01" },
    { id: "b", date: "2026-08-05" },
    { id: "c", date: "2026-08-09" },
  ];

  it("returns the live events that occupy a wanted day", () => {
    expect(findSameDayClashes("venue-1", ["2026-08-01"], live)).toEqual([live[0]]);
  });

  it("returns every clash across a multi-date series", () => {
    expect(findSameDayClashes("venue-1", ["2026-08-01", "2026-08-09"], live)).toEqual([
      live[0],
      live[2],
    ]);
  });

  it("returns nothing when no live event shares a wanted day", () => {
    expect(findSameDayClashes("venue-1", ["2026-08-02"], live)).toEqual([]);
  });

  // The leak this module closes: the admin card warned on a Mehr-Event-Bar
  // while auto-approve stacked the same row without a murmur.
  it("returns nothing for a whitelisted venue even when the day is occupied", () => {
    expect(
      findSameDayClashes("venue-1", ["2026-08-01"], live, new Set(["venue-1"])),
    ).toEqual([]);
  });

  it("falls back to MULTI_EVENT_PER_DAY_VENUE_IDS when no whitelist is passed", () => {
    const whitelisted = [...MULTI_EVENT_PER_DAY_VENUE_IDS][0];
    expect(findSameDayClashes(whitelisted, ["2026-08-01"], live)).toEqual([]);
  });

  it("agrees with decideApproval on the same whitelisted venue", () => {
    const whitelisted = [...MULTI_EVENT_PER_DAY_VENUE_IDS][0];
    const slots = buildClaimedSlots({ [whitelisted]: [{ date: "2026-08-01" }] });
    expect(findSameDayClashes(whitelisted, ["2026-08-01"], live)).toEqual([]);
    expect(
      decideApproval(makeStaged({ venueId: whitelisted }), { claimedSlots: slots }).action,
    ).toBe("insert");
  });
});
