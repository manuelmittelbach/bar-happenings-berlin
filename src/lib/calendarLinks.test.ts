import { describe, it, expect } from "vitest";
import {
  googleCalendarUrl,
  buildIcs,
  icsFilename,
  type CalendarEventInput,
} from "./calendarLinks";

const base: CalendarEventInput = {
  uid: "abc123",
  title: "Jazz Night",
  venue: "Kptn A. Müller",
  address: "Kottbusser Damm 90, Berlin",
  date: "2026-01-15",
  startTime: "20:00",
  endTime: "22:00",
  pageUrl: "https://www.insidebars.co/event/abc123",
};

describe("Berlin wall-clock → UTC conversion", () => {
  it("treats winter times as CET (UTC+1)", () => {
    const url = googleCalendarUrl(base);
    // 20:00 CET = 19:00Z, 22:00 CET = 21:00Z
    expect(url).toContain("dates=20260115T190000Z%2F20260115T210000Z");
  });

  it("treats summer times as CEST (UTC+2)", () => {
    const url = googleCalendarUrl({ ...base, date: "2026-07-15" });
    // 20:00 CEST = 18:00Z, 22:00 CEST = 20:00Z
    expect(url).toContain("dates=20260715T180000Z%2F20260715T200000Z");
  });
});

describe("end time handling", () => {
  it("defaults to start + 2h when endTime is missing", () => {
    const url = googleCalendarUrl({ ...base, endTime: undefined });
    expect(url).toContain("dates=20260115T190000Z%2F20260115T210000Z");
  });

  it("defaults to start + 2h when endTime is null", () => {
    const url = googleCalendarUrl({ ...base, endTime: null });
    expect(url).toContain("dates=20260115T190000Z%2F20260115T210000Z");
  });

  it("rolls the end to the next day when it crosses midnight", () => {
    // Summer night 23:00 → 02:00 should end on the 16th, not the 15th.
    const url = googleCalendarUrl({
      ...base,
      date: "2026-07-15",
      startTime: "23:00",
      endTime: "02:00",
    });
    // 23:00 CEST = 21:00Z on the 15th; 02:00 CEST next day = 00:00Z on the 16th
    expect(url).toContain("dates=20260715T210000Z%2F20260716T000000Z");
  });
});

describe("googleCalendarUrl", () => {
  it("includes the title, location and page link", () => {
    const url = googleCalendarUrl(base);
    expect(url).toContain("text=Jazz+Night");
    expect(url).toContain(encodeURIComponent("Kptn A. Müller, Kottbusser Damm 90, Berlin").replace(/%20/g, "+"));
    expect(url).toContain(`details=${encodeURIComponent(base.pageUrl)}`);
  });
});

describe("buildIcs", () => {
  it("produces a valid VCALENDAR/VEVENT skeleton with CRLF lines", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("DTSTART:20260115T190000Z");
    expect(ics).toContain("DTEND:20260115T210000Z");
  });

  it("sets a stable UID", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("UID:abc123@insidebars.co");
  });

  it("puts the event link only in the notes, not a separate URL property", () => {
    const ics = buildIcs(base);
    expect(ics).not.toMatch(/^URL:/m);
  });

  it("escapes commas in the location", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("LOCATION:Kptn A. Müller\\, Kottbusser Damm 90\\, Berlin");
  });

  it("puts only the page url in the description", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("DESCRIPTION:https://www.insidebars.co/event/abc123");
  });
});

describe("missing start time → all-day entry", () => {
  // An event with no known start time can't be a precise timed calendar
  // entry. Instead of throwing (Invalid Date → RangeError, which used to
  // blank the whole EventDetail page via the render-time googleCalendarUrl
  // call), it degrades to an all-day entry on the event's date.
  it("googleCalendarUrl does not throw and emits a date-only range for empty startTime", () => {
    const url = googleCalendarUrl({ ...base, startTime: "", endTime: null });
    // Google all-day: dates=YYYYMMDD/YYYYMMDD, end date EXCLUSIVE (next day).
    expect(url).toContain("dates=20260115%2F20260116");
    // No timed "…THHMMSSZ" stamp leaked into the dates value.
    expect(url).not.toMatch(/dates=[^&]*T\d{6}Z/);
  });

  it("googleCalendarUrl treats a null startTime as all-day too", () => {
    const url = googleCalendarUrl({
      ...base,
      startTime: null as unknown as string,
      endTime: null,
    });
    expect(url).toContain("dates=20260115%2F20260116");
  });

  it("googleCalendarUrl treats a whitespace-only startTime as all-day", () => {
    const url = googleCalendarUrl({ ...base, startTime: "   ", endTime: null });
    expect(url).toContain("dates=20260115%2F20260116");
  });

  it("buildIcs does not throw and emits VALUE=DATE for empty startTime", () => {
    const ics = buildIcs({ ...base, startTime: "", endTime: null });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260115");
    // End date is exclusive → the next day.
    expect(ics).toContain("DTEND;VALUE=DATE:20260116");
    // DTSTAMP must still be a valid UTC timestamp, not an invalid date.
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    // No timed DTSTART leaks in.
    expect(ics).not.toMatch(/DTSTART:\d{8}T/);
  });
});

describe("icsFilename", () => {
  it("slugifies the title", () => {
    expect(icsFilename("Jazz Night!")).toBe("jazz-night.ics");
  });

  it("falls back to 'event' for an empty slug", () => {
    expect(icsFilename("—")).toBe("event.ics");
  });
});
