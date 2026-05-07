# Visual Scrape Workflow

<!-- last-updated: 2026-05-07 — change: tightened invoke prompt, made per-venue
     loop explicit, added crash-recovery + precise importer-summary handling
     (incl. covered-by-recurring as expected skip + .env requirement), moved
     pre-import checklist to per-venue, merged step 4/5. Earlier change:
     incremental write+import per venue (was: single write at end). Earlier:
     live-date pre-filter removed; importer handles match-and-compare. -->

Standard runbook for visually scraping all active venue event websites with
Playwright/MCP and writing results to `venue_events_staging`. Designed to be
self-contained — read this file in a fresh session and you have everything
needed to execute the workflow.

## How to invoke (from a fresh Claude Code session)

For full runs (30+ venues), switch to Sonnet — same quality for this task,
much lower token cost than Opus, and 30+ importer calls + browser sessions
burn context fast:

```
/model
```
→ pick `sonnet-4-6` (or whichever Sonnet is current).

Then paste:

> Read `scripts/VISUAL_SCRAPE_WORKFLOW.md` and execute the workflow for all
> active venues.

That's it. Everything else (dedup rules, staging behavior, field rules) is
in this document.

**Crash recovery:** if a previous run crashed mid-way, just re-run the same
prompt. Already-imported venues are automatically skipped via the staged-keys
dedup in Step 1b — no manual cleanup needed.

### Tools you'll need (deferred — load before using)

The Playwright + Supabase MCP tools are deferred in fresh sessions. Load them
upfront with a single `ToolSearch` call so subsequent calls don't fail.

The `query` value must be a **single line** — the example below is split
across lines for readability only:

```
ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close,mcp__supabase__execute_sql"
```

## Step-by-step instructions

**Overall shape:** Step 1 once at the start. Then **loop per venue**:
Step 2 (scrape) → Step 3a (write batch JSON) → Step 3b (import) → next venue.
Step 4 (cleanup) once at the end. Do NOT batch all venues into a single
write — that broke a previous run by exceeding the output token limit.

### Step 1 — Read venues and existing staging

You need TWO datasets before scraping anything. The importer handles
live-event matching itself — you don't need to load live events from Claude.

Use `mcp__supabase__execute_sql` (project_id: `uybvrxqleutguucrifuf`).

**1a. Active venues** — what to scrape:
```sql
SELECT id, name, website_events
FROM venues
WHERE scrape_enabled = true AND website_events IS NOT NULL
ORDER BY name;
```

**1b. Existing staged events** (`staged_keys_by_venue`) — for dedup against
events already pending admin review (so a re-run within the same week doesn't
duplicate them). Only `is_manual=false` rows matter — manual entries are
admin-curated, separate concern:
```sql
SELECT venue_id, date, title
FROM venue_events_staging
WHERE is_manual = false
  AND date IS NOT NULL
  AND title IS NOT NULL;
```
Build a map `{venue_id: set((date, title_lowercased_collapsed_whitespace)) }`
— call it `staged_keys_by_venue`. Normalize titles the same way the
importer does: lowercase, trim, collapse runs of whitespace to single
spaces.

While scraping each venue in Step 2, skip events where the
`(date, normalized_title)` key is already in `staged_keys_by_venue[venue_id]`.

**No live-event lookup**: stage events even when a date is already covered
by a live event. The importer compares fields and either silently drops
unchanged events or stages them as updates (`replaces_event_id` set).

### Step 2 — Extract events for ONE venue

This is the start of the per-venue loop. Do Step 2 + Step 3 for the current
venue, then come back here for the next one. Don't run Step 2 for all
venues before moving to Step 3.

Use Playwright tools:

```
mcp__playwright__browser_navigate → website_events URL
mcp__playwright__browser_evaluate → '() => document.body.innerText'
mcp__playwright__browser_evaluate → grab event-detail links with their date/title context
```

Then for each event of interest (in window, not already live), navigate to its
detail page and **copy the description verbatim** — exact characters, same
language. Do NOT paraphrase or summarize even a single sentence.

Tips that worked well:
- `document.body.innerText` is much cleaner than HTML — use it as your
  primary text source.
- Group sub-link fetches: when a venue lists 10 events, fetch all 10 detail
  pages with separate `browser_navigate` calls rather than trying to parse
  them all from one overview.
- If a page says "Keine bevorstehenden Veranstaltungen" / "No upcoming events"
  / shows only events outside the window, move on — don't force a result.
- If a `(date, normalized_title)` is already in `staged_keys_by_venue[venue_id]`,
  skip — no need to fetch detail or stage.
- If a page fails (timeout, 404, anti-bot block): move on, don't retry more
  than once. The next nightly auto-scrape will pick it up if temporary.

### Step 3 — Write + import for THIS venue (incremental)

**Do NOT accumulate all venues and write at the end.** Write and import
after each venue so a crash only loses the current venue. Run the
pre-import checklist (bottom of this doc) over the venue's events before
writing.

**3a.** Write the current venue's events (and only this venue's) to
`/tmp/visual_scrape_events_batch.json` using the `Write` tool. The file is
overwritten each iteration — that's intentional; the importer is what
persists state, the batch file is just a handoff.

```json
[
  {
    "venue_id": "uuid",
    "title": "Event title as written on the page",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM" or null,
    "end_time": "HH:MM" or null,
    "doors_time": "HH:MM" or null,
    "category": "live-music" | "dj-music" | ... | null,
    "language": "English" | "German" | "English / German" | ... | null,
    "description": "verbatim page text, or null — see Field rules → description",
    "entry_info": "Free" | "Pay what you want" | "5 €" | "12,50 €" | null,
    "source_url": "https://venue.example/path/to/this-event"
  }
]
```

If the venue had no events in the window, skip Step 3 entirely and move to
the next venue — no need to run the importer with an empty array.

**3b.** Run the importer immediately:

```
python3 scripts/import_visual_events.py /tmp/visual_scrape_events_batch.json
```

It re-applies normalization, runs dedup against both live events and
existing pending staging, and inserts into `venue_events_staging` with
`is_manual=false`. Requires `scripts/.env` to provide `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` — the script hard-exits if either is missing.

**Read the summary line.** Format:
```
Done. {new} new + {update} update inserted, {unchanged} unchanged,
{recurring} covered-by-recurring, {staged} already-staged,
{window} out-of-window, {invalid} invalid.
```

Per-event lines are also printed:
- `– skipping (covered by recurring)` — silent drop because a recurring
  live event already covers this date. **Expected**, not a problem.
- `– skipping unchanged` / `already-staged` / `out-of-window` — also
  expected dedup/safety-net skips.
- `↻ update` / `+ new` — successful inserts.
- `✗ insert error` — real problem.

Decision rules:
- Hard error (script crashes / SystemExit) → STOP, report to user.
- `✗ insert error` for any event → STOP, report to user.
- `0 new + 0 update inserted` and you scraped events you expected to be
  new (not just updates / dupes) → STOP, check for `venue_id` typo.
- Otherwise (any successful inserts, or all skips were dedup) → continue.

Then go back to Step 2 with the next venue.

### Step 4 — Cleanup (once, at the end)

After all venues are done:

1. Close the browser:
   ```
   mcp__playwright__browser_close
   ```
2. Optional: remove Playwright MCP cache files (after a full run there can
   be 80+ leftover `.yml` files):
   ```
   rm -f .playwright-mcp/page-*.yml .playwright-mcp/console-*.log
   ```

## Field rules — strict, follow exactly

### `title`
The actual event name as displayed. NOT the category, NOT a teaser. If the
page only shows "Live Music" or "Comedy Night" with no specific name, use
that as-is — but check the detail page first; sometimes the real name is there.

### `date`
ISO format `YYYY-MM-DD`. Berlin/German venues default to DD.MM.YYYY format —
parse accordingly. Today's date and the 14-day window come from the system.

### `start_time`, `end_time`, `doors_time`
- 24-hour `HH:MM`, or `null` if not on the page.
- `start_time` is when the program actually begins (concert starts, DJ goes
  on, quiz first question). NOT the doors/admission time.
- `doors_time` is **only** set when the page explicitly mentions a separate
  doors / admission / Einlass time. Do NOT copy `start_time` into it.

### `category`
Must be one of these slug-IDs (NOT the labels — the labels are for the LLM /
human, slug-IDs are what the database expects):

| Label  | Slug-ID         |
|--------|-----------------|
| Live Music | `live-music`     |
| Open Mic | `open-mic`      |
| Comedy | `comedy`        |
| DJ | `dj-music`     |
| Quiz | `pub-quiz`      |
| Karaoke | `karaoke`      |
| Drag | `drag-cabaret`  |
| Screening | `screening`    |
| Dating | `singles`      |
| Other | `other`        |

Default to `other`. Only use a non-`other` slug if the event title or description EXPLICITLY and unambiguously names that format (e.g. "Live Jazz Band" → `live-music`, "Stand-up Comedy Night" → `comedy`, "DJ Set" → `dj-music`). If there is any doubt, use `other`. Never use the label string ("Live Music") — the importer will fall back to `other` if the slug doesn't match, but it's better to set it correctly.

### `language`
The language of the event itself, NOT the language of the website. Strong
preference for `null` over a guess. Only set when explicitly stated
("in English", "auf Deutsch", "bilingual", etc.). Common values: `English`,
`German`, `English / German`, `Spanish`, `French`. Never default to website
language.

### `description`

> **STOP BEFORE YOU WRITE.**
> Is what you're about to type copied character-for-character from the page?
> If not — delete it and paste the original instead.
> A summary is always wrong here, no matter how accurate it feels.

**ABSOLUTELY VERBATIM. Copy the page's exact text, character-for-character —
including punctuation, asterisks, line breaks, and pronouns. If you find
yourself writing a sentence in your own words, STOP and copy the original
instead.** Minor duplication with structured fields is intentional and OK —
the admin prefers redundant info over missed info.

**Never translate.** If the page is in German, the description stays in German.
Verbatim means same language, same words — not a translated equivalent.

#### Concrete forbidden behaviors

These all happened in real runs. Do not repeat them.

| Source says | LLM wrote (WRONG) | Why it's wrong |
|---|---|---|
| "Join us for a daytime evening where **we** improvise about **our** hearts" | "A daytime evening where **they** improvise about **their** hearts" | Pronouns changed = paraphrasing |
| "A monthly improvised live talk show... A non award winning show." | "A monthly improvised live talk show..." | Final tagline silently dropped |
| Three-sentence ***disclaimer*** about sensitive topics | (entire block omitted) | Disclaimer is event content, NOT boilerplate |
| Show subtitle (e.g. "It's That Time of the Month" under generic title "Improv") | (omitted) | Show name is critical context — keep it |

#### KEEP everything event-related — even if it feels redundant or "boilerplate-ish"

- All time labels and lines: `Doors: 19:00`, `Showtime: 20:45`,
  `Aftershow dj set: 22:00`, `Open: 18:00`, etc. — yes, even though some
  of these times also live in `doors_time` / `start_time` / `end_time`.
- All lineup info: bands, DJs, opening acts, special guests, supporters
- Performer / band / DJ bios, set descriptions, themes, atmosphere
- **Disclaimers, content warnings, feedback invitations** — three-sentence
  block about sensitive topics? Keep it. Note inviting feedback to the
  host? Keep it.
- **Show subtitles / inner names** appearing below or beside the main
  category title (e.g. event title is "Improv", actual show is "It's That
  Time of the Month") — keep both.
- **Taglines** like "A non award winning show" or "Since 2018, every Friday."
- Ticket / RSVP / reservation notes
- **External links** found in the body (eventim, ticketmaster, RA, fb event,
  bandcamp, etc.) — keep as plain text URLs. These are critical info.
- Special instructions, dress code, accessibility, age restrictions
- The event's own title appearing inline in body text

#### ONLY strip site chrome and navigation that's clearly NOT about THIS event

- Navigation to OTHER events ("Earlier Event:", "Later Event:",
  "Previous/Next Event", "Back to All Events", "Back to Program")
- Calendar export / share / "Add to calendar" buttons
- Site footer, impressum, copyright lines, privacy/terms links
- Generic venue copy ("Serving Berlin's underground since 2002") that
  appears on every page (NOT event-specific taglines)
- Truncation indicators ("weiterlesen…", "read more", "...") — if the
  truncation suggests a deeper page, follow it instead of including the
  marker

#### Self-check before finalizing

Read the description back. Does it sound like the bar wrote it (first-person
"we", their exact phrasing, all their original details)? Or does it read
like a third-party summary? If the latter, you paraphrased — go back and
copy verbatim.

Return `null` only when, after stripping the chrome above, no
event-specific content remains (e.g. page just says "tba" or has only
title+date already captured in other fields). NEVER invent content.

### `entry_info`
Must match one of these formats exactly, otherwise `null`:
- `"Free"` — no entry charge
- `"Pay what you want"` — donation / sliding scale
- `"5 €"`, `"12 €"`, `"15,50 €"` — fixed price (integer or integer,50 + space + €)
- `null` — anything else, including "Donation €10–€15", "Reservation required",
  "Tickets via …" or no info

Do not invent free-text values. The auto-scraper's `normalize_entry_info`
will reject anything not in the above list anyway.

### `source_url`
The actual URL of the event's detail page that you navigated to. NEVER invent
a URL — only use one Playwright actually loaded. If the event was only on the
overview page (no detail page exists), use the venue's `website_events` URL
as fallback.

## Rules & constraints

- 14-day window: `[today, today + 14 days]` inclusive
- Title-based dedup against `staged_keys_by_venue` (existing pending staging)
- Live-event match-and-compare happens in the **importer**, not here — stage
  events whose date already has a live event; importer drops unchanged ones
  and flags real changes as updates
- All staging rows: `is_manual=false`
- All categories: slug-ID format (lowercase, kebab-case)
- Never invent: titles, dates, times, descriptions, URLs
- Don't write directly to the database with raw SQL — use the importer script
  so normalization stays consistent with the auto-scraper
- Don't `is_manual=true` for these — that would put them in the Manual tab,
  not Scraped
- Don't set `created_by_admin=true` — these are scraper-class events
- Don't follow links to non-event pages (impressum, privacy, ticketing
  third-parties like Eventbrite) — they don't contain event data we need
- Don't include past events even if listed prominently on the page

## Pre-import checklist

Run this **per venue, before each Step 3a write** — not once at the end.
The batch only contains one venue's events, so this is a quick check.

- Every event has a real `source_url` (paste a few into the address bar
  mentally and check they look like detail-page URLs)
- Every `category` is a slug-ID (`live-music`, not `Live Music`)
- Every `date` is in `[today, today + 14 days]`
- No truncation marker (`…`, `weiterlesen`, `read more`) in any description

The importer will skip duplicates and out-of-window events as a safety net,
but doing it right upstream keeps the logs clean and makes the run finish
faster.
