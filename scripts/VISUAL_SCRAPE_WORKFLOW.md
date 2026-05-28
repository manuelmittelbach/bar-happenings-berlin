# Visual Scrape Workflow

<!-- last-updated: 2026-05-28 -->

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

**Context management:** For runs of 10+ venues the main context window fills
up quickly (browser content is large). Use the **sub-agent orchestration
model** described in the "Orchestration model" section below. The orchestrator
runs Step 1, splits venues into batches, spawns parallel sub-agents (one per
batch), and collects compact summaries. Each sub-agent has its own fresh
context — browser content never lands in the main session.

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
If you extracted **zero events** for a venue (for ANY reason), run Step 2b
(placeholder) instead of Step 3 and move on. Step 4 (cleanup) once at the
end. Do NOT batch all venues into a single write — that broke a previous
run by exceeding the output token limit.

> **For full runs (30+ venues):** the per-venue loop below is what each
> **sub-agent** follows for its own batch. The main orchestrator does Step 1,
> then spawns sub-agents instead of looping itself — see "Orchestration model".

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
- **If `innerText` yields little or no content (< ~200 chars of real text):**
  don't skip immediately. Check for two patterns:
  1. **iFrame**: `document.querySelectorAll('iframe')` — if present, navigate
     directly to the `src` URL instead (e.g. Donau115 embeds a Google Sheet).
  2. **Event image**: `document.querySelectorAll('img')` — if an image with an
     event-related `alt` or filename (e.g. "Mai Events.png") is found, use
     `mcp__playwright__browser_navigate` to open the image URL directly, then
     `mcp__playwright__browser_take_screenshot` and read the screenshot with the
     `Read` tool to extract events visually (e.g. Jatz Bar publishes a monthly
     PNG). Use the venue's `website_events` URL as `source_url` in this case.

### Step 2b — Placeholder when zero events extracted

If you extracted **zero events** for this venue — for **any reason** —
stage a placeholder. The placeholder surfaces in the Admin "Manual" tab as
a soft reminder to enter events by hand if you happen to know about
something at this venue.

**Trigger for any of:**
- Page says "Keine bevorstehenden Veranstaltungen" / "no upcoming events"
- Page only shows events outside the 14-day window
- Page only shows past events
- 404, timeout, or other load failure
- Anti-bot / paywall hid the content
- iframe / image-OCR extraction failed
- Layout unparseable (no clear event blocks)

**No placeholder when you extracted at least one event** — even if the
importer later skips them all as already-live, covered-by-recurring,
already-staged, or unchanged. The page had events; the admin already sees
them via the live UI.

Run:

```
python3 scripts/stage_visual_placeholder.py VENUE_ID SOURCE_URL
```

Use the venue's `website_events` URL as `SOURCE_URL`. The script is
idempotent — if a placeholder already exists for the venue it skips. After
this, skip Step 3 and continue with the next venue.

### Step 3 — Write + import for THIS venue (incremental)

**Do NOT accumulate all venues and write at the end.** Write and import
after each venue so a crash only loses the current venue. Run the
pre-import checklist (bottom of this doc) over the venue's events before
writing.

**3a.** Write the current venue's events (and only this venue's) to
`/tmp/visual_scrape_events_batch.json`. The file is overwritten each
iteration — that's intentional; the importer is what persists state, the
batch file is just a handoff.

**Always use `python3 + json.dumps` — never the `Write` tool directly.**
Descriptions frequently contain German typographic quotes like `„word"` where
the closing character is a plain ASCII `"` (U+0022). Written by hand this
silently terminates the JSON string and causes a parse error. `json.dumps`
escapes everything correctly regardless of content.

```python
python3 << 'EOF'
import json
events = [
  {
    "venue_id": "uuid",
    "title": "Event title as written on the page",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM",   # or None
    "end_time": "HH:MM",     # or None
    "doors_time": "HH:MM",   # or None
    "category": "Live Music",  # label from category table, or None
    "language": "English",   # or None
    "description": "verbatim page text",  # or None
    "entry_info": "5 €",     # or None
    "source_url": "https://venue.example/path/to/this-event"
  }
]
with open('/tmp/visual_scrape_events_batch.json', 'w', encoding='utf-8') as f:
    json.dump(events, f, ensure_ascii=False, indent=2)
EOF
```

If you extracted zero events for this venue, skip Step 3 entirely and run
Step 2b (placeholder) instead — don't run the importer with an empty array.

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
- Hard crash or any `✗ insert error` → STOP, report to user.
- `0 new + 0 update inserted` despite scraping events expected to be new
  (not just updates/dupes) → STOP, check for `venue_id` typo.
- Otherwise → continue.

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

## Orchestration model

For runs of 10+ venues, the main orchestrator uses **sub-agents per batch**
so the main context stays small. Browser content accumulates quickly even
for a handful of venues; sub-agents contain that within their own sessions.

### Orchestrator flow (replaces the per-venue loop after Step 1)

1. Run Step 1a + 1b (venue list + staged keys) in the main session.
2. Build `staged_keys_by_venue` as usual.
3. Split the venue list into batches of **~8 venues each**.
4. Spawn all batches as **parallel sub-agents** in a single message
   (multiple `Agent` tool calls at once). Pass each sub-agent a
   self-contained prompt — see template below.
5. Wait for all sub-agents to return their compact summaries.
6. If any sub-agent reports a `✗ insert error` or hard crash, re-run just
   that batch's venues (the dedup will skip anything already staged).
7. Run Step 4 cleanup (browser_close + remove .playwright-mcp files) in the
   main session once all batches are done.

> **No browser_close needed in the main session** — each sub-agent closes
> its own browser at the end of its batch.

### Sub-agent prompt template

Fill in `{TODAY}`, `{WINDOW_END}`, the staged-keys subset (only for the
batch's venue IDs), and the venue list. The project root is
`/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin`.

```
Working directory: /Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin

You are scraping a batch of Berlin bar venues. Read
`scripts/VISUAL_SCRAPE_WORKFLOW.md` for all field rules (Step 2 scraping,
Step 2b placeholder, Step 3 write+import, field rules, pre-import checklist).

Today: {TODAY}. Window: {TODAY} to {WINDOW_END} (inclusive).

Already-staged keys for YOUR venues only — skip events where
(date, normalized_title) is already present:
{JSON map: venue_id → [[date, normalized_title], ...]}

Your venues (process in order, one at a time):
1. Name — venue_id — website_events URL
2. ...

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close,mcp__supabase__execute_sql"

Then for each venue: Step 2 (scrape) → Step 3a+3b (write+import), or
Step 2b (placeholder) for zero-event venues. After the last venue, call
browser_close once.

Return a compact summary — one line per venue:
  "Venue Name: N new + M update" or "Venue Name: placeholder" or "Venue Name: all skipped (dedup)"
Stop and flag immediately on any ✗ insert error.
```

### Notes on parallel execution

- All batches can run in one parallel message — sub-agents use independent
  browser sessions, no shared state.
- Staged-keys passed to each sub-agent only need to cover that batch's
  venue IDs — filter the full map before building the prompt.
- Sub-agent summaries are short (1 line per venue), so the orchestrator's
  context grows very slowly regardless of how many batches there are.
- If a sub-agent crashes mid-batch, re-run with the same venue list — the
  dedup skips anything already staged, so only the remaining venues get
  processed.

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
Use one of these labels (the importer maps them to internal IDs):

| Label       |
|-------------|
| Live Music  |
| Open Mic    |
| Comedy      |
| DJ          |
| Quiz        |
| Karaoke     |
| Drag        |
| Screening   |
| Dating      |
| Other       |

Default to `Other`. Only use a non-`Other` label if the event title or description EXPLICITLY and unambiguously names that format (e.g. "Live Jazz Band" → `Live Music`, "Stand-up Comedy Night" → `Comedy`, "DJ Set" → `DJ`). If there is any doubt, use `Other`.

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
Hierarchy — use the most specific that fits the page:
1. `"Free"` — no entry charge
2. `"Donation"` — fully optional payment / "pay what you want" wording. Map
   common German donation indicators here too: `"Spende"`, `"Spendenbasis"`,
   `"Auf Spendenbasis"`, `"Spende"`, `"Die Band sammelt am Ende"`.
   Do NOT map sliding-scale ranges (e.g. `"5–15 €"`) — those go to free-text.
3. `"5 €"`, `"12 €"`, `"15,50 €"` — fixed price (integer or integer,50 + space + €)
4. **Free-text fallback** — pricing IS stated on the page but doesn't fit
   1–3. Copy the page's wording verbatim, single line, ≤80 chars. Examples
   that should be kept (not nulled): `"5–15 € sliding scale"`,
   `"Donations 5–10 €"`, `"Tickets via Eventim"`,
   `"First drink costs double"`, `"Reservation required"`.
5. `null` — only when the page says nothing about pricing at all.

Never invent — the value must come from the page text. The Admin UI
auto-detects free-text values and shows them in `Custom…` mode, so they
round-trip cleanly. The importer caps free-text at 80 chars and collapses
whitespace.

### `source_url`
The actual URL of the event's detail page that you navigated to. NEVER invent
a URL — only use one Playwright actually loaded. If the event was only on the
overview page (no detail page exists), use the venue's `website_events` URL
as fallback.

## Rules & constraints

- 14-day window: `[today, today + 14 days]` inclusive
- Title-based dedup against `staged_keys_by_venue` (existing pending staging)
- All staging rows: `is_manual=false`
- All categories: label from the table above (`Live Music`, `DJ`, ...)
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
- Every `category` is one of the labels in the table (`Live Music`, `DJ`, etc.)
- Every `date` is in `[today, today + 14 days]`
- No truncation marker (`…`, `weiterlesen`, `read more`) in any description

The importer will skip duplicates and out-of-window events as a safety net,
but doing it right upstream keeps the logs clean and makes the run finish
faster.
