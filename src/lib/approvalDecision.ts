import type { StagedEvent } from "@/types/event";

// Venues that are allowed to have MORE than one event on the same day during
// auto-approve. By default a bar that already has an event that day blocks any
// new same-day row (it gets left for manual review). For the venues listed
// here that same-day clash check is skipped, so every scraped row is approved
// even when the bar already has events that day — useful for multi-stage
// venues, festivals, or programmes with several acts per night.
//
// Keyed by venue UUID (not name) so accents/typos can't break the match — same
// pattern as the category overrides in scripts/scrape_helpers.py. Add the
// venue's id from the `bars`/`venues` table to allow same-day stacking.
export const MULTI_EVENT_PER_DAY_VENUE_IDS = new Set<string>([
  "e905bf80-afdb-417a-bba4-6aaa6962097d", // Comedy Café Berlin
  "54609d56-759b-444c-88ac-4766bf2ec71c", // Mein Freund Harvey
  "a4855d6d-2f68-4c97-bd98-759e4628aa8b", // Paloma Bar
]);

// The one answer to "may this bar hold more than one event on a day?". Both
// the unattended batch (through decideApproval) and the admin card's clash
// warning ask here, so a Mehr-Event-Bar can't be a clash on one path and a
// legitimate stack on the other.
function stacksSameDay(venueId: string, whitelist: Set<string>): boolean {
  return whitelist.has(venueId);
}

// A (bar|day) slot key. One format, so a slot claimed by one caller is read as
// claimed by the next.
export function slotKey(venueId: string, date: string): string {
  return `${venueId}|${date}`;
}

// Seeds the occupied (bar|day) slots from a live-events-by-venue map. Approved
// OR canceled both count as "the bar already has an event that day" — the
// caller decides which events to hand in; every one of them claims its slot.
// The batch extends the returned set as it approves, so two staged rows for the
// same new slot can't both land.
export function buildClaimedSlots(
  liveByVenue: Record<string, { date: string }[]>,
): Set<string> {
  const slots = new Set<string>();
  for (const [venueId, events] of Object.entries(liveByVenue)) {
    for (const e of events) slots.add(slotKey(venueId, e.date));
  }
  return slots;
}

// The clash question for the attended path: which of `events` sit on a day this
// row wants? Returns the events themselves — the admin card links them so a
// human can compare — where decideApproval only needs a yes/no. `dates` is a
// set of days because a recurring row claims its whole series at once.
//
// A whitelisted venue never clashes, exactly as in decideApproval's gate 4.
// `events` are assumed to be the live events of `venueId` already.
//
// `dates` is deliberately NOT Iterable<string>: a bare date string satisfies
// that, and iterating it would yield characters and silently match nothing.
export function findSameDayClashes<E extends { date: string }>(
  venueId: string,
  dates: readonly string[] | ReadonlySet<string>,
  events: E[],
  whitelist: Set<string> = MULTI_EVENT_PER_DAY_VENUE_IDS,
): E[] {
  if (stacksSameDay(venueId, whitelist)) return [];
  const wanted = new Set(dates);
  return events.filter(e => wanted.has(e.date));
}

export type ApprovalAction = "insert" | "update" | "skip";

export interface ApprovalDecision {
  action: ApprovalAction;
  // Present only for "skip" — the human-readable reason surfaced to the admin.
  reason?: string;
}

// Only the fields the decision depends on. The real callers pass a full
// StagedEvent (which satisfies this Pick); tests build just these six.
type DecisionInput = Pick<
  StagedEvent,
  "verifyVerdict" | "replacesEventId" | "venueId" | "title" | "date" | "category"
>;

interface DecisionContext {
  // Occupied `${venueId}|${date}` slots — every live event plus rows already
  // approved earlier in the same run. Built and mutated by the caller.
  claimedSlots: Set<string>;
  // Venues exempt from the same-day clash check. Defaults to the module
  // constant; passed explicitly only by tests. Both callers rely on the
  // default so preview and effect apply the SAME whitelist (see the preview
  // bug this module fixes).
  whitelist?: Set<string>;
}

// The single source of truth for what the bulk auto-approve flow does with one
// staged row. Pure: no DB I/O, no mutation — it returns a verdict and the
// caller performs the matching insert / update / skip. The gate order mirrors
// the historic inline checks so behaviour is unchanged:
//   0. verify verdict must be "confirmed" (new AND update rows)
//   1. an update row (replacesEventId set) is patched onto its live event
//   2. a new row needs a linked venue
//   3. a new row needs title, date and category
//   4. a new row must not clash with an existing same-bar/same-day event,
//      unless its venue is whitelisted to stack
export function decideApproval(
  staged: DecisionInput,
  { claimedSlots, whitelist = MULTI_EVENT_PER_DAY_VENUE_IDS }: DecisionContext,
): ApprovalDecision {
  // Gate 0 — verify verdict. confirmed_weak stays out deliberately: the
  // unconfirmed date is exactly the risk the sweep exists to catch.
  if (staged.verifyVerdict !== "confirmed") {
    return {
      action: "skip",
      reason: staged.verifyVerdict
        ? `verify verdict "${staged.verifyVerdict}" — review manually`
        : "not verified yet — run the verify sweep first",
    };
  }

  // Update rows patch an existing event — they never insert and never clash
  // (they share their target's day by definition). The fetch/diff/patch I/O
  // lives in the caller; here we only classify the row.
  if (staged.replacesEventId) {
    return { action: "update" };
  }

  if (!staged.venueId) {
    return { action: "skip", reason: "no venue linked" };
  }
  if (!staged.title.trim() || !staged.date || !staged.category) {
    return { action: "skip", reason: "missing title, date or category" };
  }

  if (
    !stacksSameDay(staged.venueId, whitelist) &&
    claimedSlots.has(slotKey(staged.venueId, staged.date))
  ) {
    return { action: "skip", reason: "another event already exists in this bar that day" };
  }

  return { action: "insert" };
}
