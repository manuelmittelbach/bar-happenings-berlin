# Visual Scrape Workflow

Standard runbook for visually scraping all active venue event websites with
Playwright/MCP and writing results to `venue_events_staging`. Designed to be
self-contained — read this file in a fresh session and you have everything
needed to execute the workflow.

## How to invoke (from a fresh Claude Code session)

Before starting, switch to Sonnet — same quality for this task at much lower
token cost than Opus:

```
/model
```
→ pick `sonnet-4-6` (or whichever Sonnet is current).

Then paste:

> Read `scripts/VISUAL_SCRAPE_WORKFLOW.md` and execute the workflow for all
> active venues. Stage every upcoming event you find into `venue_events_staging`
> via `scripts/import_visual_events.py`. Skip already-live dates and anything
> outside the 14-day window.

That's all the operator needs to type. The rest is in this document.

### Tools you'll need (deferred — load before using)

The Playwright + Supabase MCP tools are deferred in fresh sessions. Load them
upfront with a single `ToolSearch` call so subsequent calls don't fail:

```
ToolSearch query=
  "select:mcp__playwright__browser_navigate,
          mcp__playwright__browser_evaluate,
          mcp__playwright__browser_close,
          mcp__supabase__execute_sql"
```

(Single line — split here for readability.)

## What this workflow does

1. Loads two datasets from Supabase: active venues, and existing pending
   staging entries (for staging-dedup). Note: live events are NOT skipped at
   scrape time anymore — the importer matches scraped events against live
   events and only stages real changes.
2. For each venue:
   - Navigates with Playwright, extracts visible upcoming events
   - Filters to today + 14 days
   - Skips events already pending in staging (same venue + date + title)
   - Builds an event object with normalized fields — including events whose
     date is already covered by a live event (the importer handles that)
3. Writes all events as one JSON batch through `import_visual_events.py`
   which:
   - Stages new events (no match against live) as `replaces_event_id=NULL`
   - Detects updates (match + at least one diverging compare-field) as
     `replaces_event_id=<live_event.id>` — admin reviews diff in the dashboard
   - Silently drops unchanged events and recurring-template matches

## Step-by-step instructions

### Step 1 — Read venues and existing staging

You need TWO datasets before scraping anything. The importer handles
live-event matching itself — you don't need to load live events from Claude.

Use `mcp__supabase__execute_sql` (project_id: `uybvrxqleutguucrifuf`).

**1a. Active venues** — what to scrape:
```sql
SELECT id, name, website_events
FROM venues
WHERE online = 'yes' AND website_events IS NOT NULL
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

### Step 2 — For each venue, extract events

For each venue, use Playwright tools:

```
mcp__playwright__browser_navigate → website_events URL
mcp__playwright__browser_evaluate → '() => document.body.innerText'
mcp__playwright__browser_evaluate → grab event-detail links with their date/title context
```

Then for each event of interest (in window, not already live), navigate to its
detail page and grab the full description.

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

### Step 3 — Build the JSON file

After all venues are processed, write the full collected event list to
`/tmp/visual_scrape_events.json` using the `Write` tool (one call, single
JSON array). Don't try to append per venue — write once at the end.

Schema:

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
    "description": "Verbatim event-related content from the detail page" or null,
    "entry_info": "Free" | "Pay what you want" | "5 €" | "12,50 €" | null,
    "source_url": "https://venue.example/path/to/this-event"
  }
]
```

### Step 4 — Run the importer

```
python3 scripts/import_visual_events.py /tmp/visual_scrape_events.json
```

It re-applies normalization, runs a final dedup against BOTH live events
AND existing pending staging, and inserts into `venue_events_staging` with
`is_manual=false`. Read its summary line at the end to verify the counts
match what you intended.

### Step 5 — Cleanup

The Playwright MCP server caches snapshot/console files under
`.playwright-mcp/`. After a full run there can be 80+ leftover `.yml` files.
Optional cleanup:

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
**ABSOLUTELY VERBATIM. Copy the page's exact text, character-for-character —
including punctuation, asterisks, line breaks, and pronouns. If you find
yourself writing a sentence in your own words, STOP and copy the original
instead.** Minor duplication with structured fields is intentional and OK —
the admin prefers redundant info over missed info.

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

## Constraints summary

- 14-day window: `[today, today + 14 days]` inclusive
- Title-based dedup against `staged_keys_by_venue` (existing pending staging)
- Live-event match-and-compare happens in the **importer**, not here — stage
  events whose date already has a live event; importer drops unchanged ones
  and flags real changes as updates
- All staging rows: `is_manual=false`
- All categories: slug-ID format (lowercase, kebab-case)
- Never invent: titles, dates, times, descriptions, URLs

## What NOT to do

- Don't write directly to the database with raw SQL — use the importer script
  so normalization stays consistent with the auto-scraper
- Don't `is_manual=true` for these — that would put them in the Manual tab,
  not Scraped
- Don't set `created_by_admin=true` — these are scraper-class events
- Don't follow links to non-event pages (impressum, privacy, ticketing
  third-parties like Eventbrite) — they don't contain event data we need
- Don't include past events even if listed prominently on the page

## Counting on yourself

Final sanity check before running the importer:
- Every event has a real `source_url` (paste a few into the address bar
  mentally and check they look like detail-page URLs)
- Every `category` is a slug-ID (`live-music`, not `Live Music`)
- Every `date` is in `[today, today + 14 days]`
- No truncation marker (`…`, `weiterlesen`, `read more`) in any description

The importer will skip duplicates and out-of-window events as a safety net,
but doing it right upstream keeps the logs clean and makes the run finish
faster.
