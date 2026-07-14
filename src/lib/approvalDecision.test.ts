import { describe, it, expect } from "vitest";
import { decideApproval, MULTI_EVENT_PER_DAY_VENUE_IDS } from "./approvalDecision";

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
