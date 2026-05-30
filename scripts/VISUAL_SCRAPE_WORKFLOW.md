# Visual Scrape Workflow

<!-- last-updated: 2026-05-30 (windowEnd is now computed by the script from today (pure arithmetic), not resolved via a setup agent — orchestrator only passes today; canonical workflow script scripts/visual-scrape.workflow.js is the single source of truth for the sequential loop + sub-agent dispatch; Step 1 in scripts/visual_scrape_helper.py list) -->

Standard runbook for visually scraping all active venue event websites with
Playwright/MCP and writing results to `venue_events_staging`. This file is the
**orchestrator's** guide — read it and you can run the fleet. Each sub-agent
additionally reads `scripts/VISUAL_SCRAPE_FIELD_RULES.md` for the per-venue
procedure and field rules.

## How to invoke (from a fresh Claude Code session)

Switch the session to Sonnet before starting — same quality for this scrape
task, much lower token cost than Opus:

```
/model
```
→ pick `sonnet-4-6` (or whichever Sonnet is current).

**Why Sonnet matters:** the run uses sub-agent orchestration. The orchestrator
itself stays tiny (Step 1 + invoking the workflow), but **sub-agents inherit the
session model**, so the `/model` switch is what makes every spawned venue agent
run on Sonnet — and the sub-agents are where ~all the tokens go.

Then paste:

> Read `scripts/VISUAL_SCRAPE_WORKFLOW.md` and execute the workflow for all
> active venues.

Claude reads `currentDate` from memory and passes `today` as `args` when
invoking the Workflow tool. The script derives `windowEnd` (today + 14 days)
itself by pure arithmetic, so it does not need to be passed. Everything else
(dedup rules, staging behavior, field rules) is in this document, the canonical
workflow script, or the per-venue manual it points to.

**This is the only path — always orchestrate with the canonical workflow
script.** The orchestrator runs Step 1, then invokes
`scripts/visual-scrape.workflow.js` via the Workflow tool's `scriptPath`, which
spawns **one sub-agent per venue, sequentially**. Each sub-agent has its own
fresh context, so browser content never accumulates in the main session. Do not
hand-write a new workflow or run the per-venue loop inline in the main session.

> **Do not hand-write a new workflow each run.** The sequential loop and the
> per-venue sub-agent dispatch are hard-wired in
> `scripts/visual-scrape.workflow.js` precisely so they can't drift. Run that
> file via the Workflow tool's `scriptPath`; only edit the script itself if the
> orchestration logic genuinely changes.

**Crash recovery:** to resume a partial run, relaunch the workflow with the same
`scriptPath` plus `resumeFromRunId` — completed venues return from cache, only
unfinished ones re-scrape. A plain re-run (no resume) re-scrapes every venue;
this is safe (the importer dedups already-staged events at the *event* level via
each venue's staged keys), just not faster. Venues that only got a placeholder
last time (`is_manual=true`) aren't in the staged-keys set, so they're fully
re-scraped (the placeholder insert is idempotent).

### Tools you'll need (deferred — load before using)

The Playwright + Supabase MCP tools are deferred in fresh sessions. The
orchestrator only needs Supabase for Step 1 (and even that runs through the
helper script); each sub-agent loads Playwright itself (see the sub-agent
template in the workflow script). The helper uses `scripts/.env` directly, so
in the main session you typically need no MCP tools at all to run Step 1 — just
a shell. (Load `mcp__supabase__execute_sql` only if you want to inspect the DB
by hand.)

## Step-by-step instructions

**Map of the run:** the orchestrator does **Step 1** once (build the venue
work-list), then invokes the **canonical workflow script**
`scripts/visual-scrape.workflow.js`, which spawns **one sub-agent per venue,
sequentially** (hard rule: one agent = one venue). Each agent scrapes its single
venue and imports it — or stages a placeholder if it found nothing — then
returns a status object. The full per-venue procedure (Steps 2–3) and field
rules live in `scripts/VISUAL_SCRAPE_FIELD_RULES.md`, which each agent reads via
its prompt. **Step 4** (cleanup) runs once in the main session at the end.

### Step 1 — Build the venue work-list

Run the helper (it queries Supabase project `uybvrxqleutguucrifuf` via
`scripts/.env`):

```
python3 scripts/visual_scrape_helper.py list --out /tmp/visual_scrape_venues.json
```

This writes a JSON array, one object per active scrape-enabled venue, each
annotated with the events already pending review for that venue:

```json
{
  "venue_id":       "uuid",
  "name":           "Venue name",
  "website_events": "https://…",
  "staged_keys":    [["2026-05-30", "normalized title"], ...]
}
```

- **Active venues** = `scrape_enabled = true AND website_events IS NOT NULL`.
- **`staged_keys`** = `(date, normalize_title(title))` for every non-manual
  `venue_events_staging` row of that venue, normalized exactly like the importer
  (lowercase, trim, collapse whitespace). Each sub-agent skips any event whose
  `(date, normalized_title)` is already in its set, so a re-run within the same
  week doesn't re-fetch detail pages for events still pending review. Only
  `is_manual=false` rows are included — manual entries are admin-curated, a
  separate concern.

**No live-event lookup is needed here**: the importer itself compares each
scraped event against live events and either silently drops unchanged ones or
stages them as updates (`replaces_event_id` set). Step 1 only needs venues +
staged keys.

### Steps 2–3 — Per-venue scrape + import (the sub-agents)

The per-venue work — scrape the page (with iframe / image-OCR fallbacks), write
the events JSON, run the importer, or stage a placeholder if nothing was found —
plus the strict field rules and the pre-import checklist all live in
**`scripts/VISUAL_SCRAPE_FIELD_RULES.md`**. Each sub-agent reads that file; the
exact dispatch prompt it runs is `subAgentPrompt()` in
`scripts/visual-scrape.workflow.js`. The orchestrator does not run these steps
itself.

### Step 4 — Cleanup (once, at the end)

After the workflow returns, in the main session:

1. **No `browser_close` needed in the main session** — the main session never
   opens a browser; each sub-agent already closed its own at the end of its run.
2. Optional: remove Playwright MCP cache files (after a full run there can
   be 80+ leftover `.yml` files) and any image-OCR screenshots:
   ```
   rm -f .playwright-mcp/page-*.yml .playwright-mcp/console-*.log
   rm -f /tmp/visual_scrape_shot_*.png /tmp/visual_scrape_*.json
   ```

## Orchestration model

### ⚠ Shared browser — no parallel browser calls

The Playwright MCP server runs **one browser with one current tab** shared
across every tool call in the session. Running multiple browser agents
concurrently causes agents to interleave `browser_navigate` /
`browser_evaluate` calls on the same tab — agent A navigates to URL_A,
agent B navigates to URL_B before A reads, and A silently reads URL_B's
content and produces wrong scraped data.

This bug was confirmed in a recurring-series verification run where three
agents returned page content belonging to other venues that happened to be
navigated concurrently. The agents are **not** isolated; there is no
per-agent browser context.

**Always run venue agents sequentially** — one finishes (including
`browser_close`) before the next starts. This is why the canonical workflow
script uses a `for` loop, **not** `pipeline()` or `parallel()`. Do not change
that.

### Orchestrator flow (main session)

1. Run **Step 1** → `/tmp/visual_scrape_venues.json`.
2. Invoke the **canonical workflow script** via the Workflow tool's `scriptPath`,
   passing `today` as `args` (the venues are loaded from the file by a setup
   agent, and `windowEnd` is computed by the script, so neither needs to go
   through `args`):
   ```js
   Workflow({
     scriptPath: "scripts/visual-scrape.workflow.js",
     args: { today: "<currentDate>" },
   })
   ```
   The script runs **one agent per venue in a strictly sequential `for` loop**
   (never `pipeline()`/`parallel()` — see the shared-browser warning above),
   forces each agent to return a schema-validated `{venue_name, status}` object,
   and returns a summary (counts + any venues whose status looked like an error).
   All `args` are optional — with none passed, the script resolves `today` via a
   setup agent (`date +%F`), derives `windowEnd` from it, and loads venues from
   the file. `windowEnd` can still be passed in `args` as an explicit override
   if you ever want a different window.
3. **Best-effort (see memory `feedback_scraper_best_effort`):** a single venue
   erroring out does NOT stop the fleet — the loop logs it and moves on. Relay
   the returned summary to the user; mention any `errored` venues, but a lost
   event is acceptable and not a reason to halt.
4. Run **Step 4** cleanup in the main session.

### Sub-agent result schema (StructuredOutput)

```json
{
  "type": "object",
  "required": ["venue_name", "status"],
  "properties": {
    "venue_name": {"type": "string"},
    "status":     {"type": "string"}
  }
}
```

### Sub-agent prompt — lives in code (single source of truth)

The exact prompt each sub-agent runs is `subAgentPrompt()` in
`scripts/visual-scrape.workflow.js`. It points the agent at
`scripts/VISUAL_SCRAPE_FIELD_RULES.md` (the per-venue manual), fills in the
venue + that venue's staged keys + the `[today, windowEnd]` window, and tells it
to either run `import_visual_events.py` or `stage_visual_placeholder.py`. To
change the dispatch behavior, edit that function; to change scrape/field rules,
edit `VISUAL_SCRAPE_FIELD_RULES.md`.
