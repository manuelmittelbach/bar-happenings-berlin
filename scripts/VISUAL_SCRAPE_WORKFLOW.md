# Visual Scrape Workflow

<!-- last-updated: 2026-05-29 (split per-venue procedure + field rules into scripts/VISUAL_SCRAPE_FIELD_RULES.md so each sub-agent reads ~290 lines, not the whole runbook) -->

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

**Why Sonnet matters:** the run always uses the sub-agent orchestration model
(see "Orchestration model" below). The orchestrator itself stays tiny (just
Step 1 + spawning), but **sub-agents inherit the session model**, so the
`/model` switch is what makes every spawned venue agent run on Sonnet — and the
sub-agents are where ~all the tokens go. The orchestrator's own model barely
matters.

Then paste:

> Read `scripts/VISUAL_SCRAPE_WORKFLOW.md` and execute the workflow for all
> active venues.

That's it. Claude reads `currentDate` from memory and passes `today` and
`windowEnd` (today + 14 days) automatically as `args` when invoking the
Workflow tool. Everything else (dedup rules, staging behavior, field rules)
is in this document or the per-venue manual it points to.

**This is the only path — always orchestrate with sub-agents.** The orchestrator
runs Step 1, then spawns **one sub-agent per venue, sequentially** (see the
shared-browser warning in the Orchestration model). Each sub-agent has its own
fresh context, so browser content never accumulates in the main session — this
holds regardless of how many venues there are. Do not run the per-venue loop
inline in the main session.

**Crash recovery:** if a previous run crashed mid-way, just re-run the same
prompt. Already-imported venues are automatically skipped via the staged-keys
dedup in Step 1b — no manual cleanup needed.

### Tools you'll need (deferred — load before using)

The Playwright + Supabase MCP tools are deferred in fresh sessions. The
orchestrator only needs Supabase for Step 1; each sub-agent loads Playwright
itself (see the sub-agent template). So in the main session, load just:

```
ToolSearch query="select:mcp__supabase__execute_sql"
```

## Step-by-step instructions

**Map of the run:** the orchestrator does **Step 1** once, then spawns **one
sub-agent per venue** (hard rule: one agent = one venue). Each agent scrapes its
single venue, imports it (or stages a placeholder if it found nothing), then
returns — the full per-venue procedure (Steps 2–3) and field rules live in
`scripts/VISUAL_SCRAPE_FIELD_RULES.md`, which each agent reads via its prompt.
Step 4 (cleanup) runs once in the main session at the end. Spawn mechanics:
**"Orchestration model"**.

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

Each sub-agent receives only its own venue's staged keys (via the prompt
template), and skips any event whose `(date, normalized_title)` is already in
that set.

**No live-event lookup**: stage events even when a date is already covered
by a live event. The importer compares fields and either silently drops
unchanged events or stages them as updates (`replaces_event_id` set).

### Steps 2–3 — Per-venue scrape + import

The per-venue work — scrape the page (with iframe / image-OCR fallbacks), write
the events JSON, run the importer, or stage a placeholder if nothing was found —
plus the strict field rules and the pre-import checklist all live in
**`scripts/VISUAL_SCRAPE_FIELD_RULES.md`**. Each sub-agent reads that file (its
prompt template points at it); the orchestrator does not run these steps itself.

### Step 4 — Cleanup (once, at the end)

After all sub-agents are done, in the main session:

1. **No `browser_close` needed in the main session** — the main session never
   opens a browser; each sub-agent already closed its own at the end of its run.
2. Optional: remove Playwright MCP cache files (after a full run there can
   be 80+ leftover `.yml` files) and any image-OCR screenshots:
   ```
   rm -f .playwright-mcp/page-*.yml .playwright-mcp/console-*.log
   rm -f /tmp/visual_scrape_shot_*.png
   ```

## Orchestration model

This is the standard (and only) execution model — used for **every** run,
regardless of venue count. The Workflow tool spawns **one sub-agent per venue
sequentially**. Each agent handles exactly one venue, so browser content never
accumulates across venues and peak context stays low (~50–80k per agent vs.
150k+ with batching). See **"⚠ Shared browser — no parallel browser calls"**
below for why agents must not run concurrently.

### Orchestrator flow (main session)

1. Run Step 1a + 1b (venue list + staged keys) in the main session.
2. Build `staged_keys_by_venue` as usual.
3. Spawn **one agent per venue sequentially** via a `for` loop — **not**
   `pipeline()` or `parallel()`:
   ```js
   const results = []
   for (const v of venues) {
     const r = await agent(subAgentPrompt(v), { label: v.name })
     if (r) results.push(r)
   }
   ```
   See **"⚠ Shared browser — no parallel browser calls"** below for why.
4. Each agent gets only its own venue's staged keys — no large JSON blob.
5. After each agent returns its result, check for `✗ insert error` — stop
   and report immediately if found.
6. Run Step 4 cleanup in the main session once all agents are done.

### Sub-agent prompt template

Fill in `{TODAY}`, `{WINDOW_END}`, the staged-keys for this venue only, and
the venue details. Use a **unique temp file per venue** to avoid parallel
write conflicts: `/tmp/visual_scrape_{venue_id}.json`. The project root is
`/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin`.

```
Working directory: /Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin

Read scripts/VISUAL_SCRAPE_FIELD_RULES.md — your complete per-venue manual
(scrape procedure + field rules + pre-import checklist). It is the only file
you need to read.

Today: {TODAY}. Window: {TODAY} to {WINDOW_END} (inclusive).

Your venue (only this one):
  Name: {name}
  ID:   {venue_id}
  URL:  {website_events}

Already-staged keys for this venue:
[["{date}", "{normalized_title}"], ...]

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_close"

Then:
- Step 2: navigate to the URL, extract events in [{TODAY}, {WINDOW_END}]
- If events found: write to /tmp/visual_scrape_{venue_id}.json using python3
  + json.dumps, then run: python3 scripts/import_visual_events.py /tmp/visual_scrape_{venue_id}.json
- If zero events: run: python3 scripts/stage_visual_placeholder.py {venue_id} {website_events}
- Call browser_close when done.

Return: {"venue_name": "...", "status": "N new + M update inserted" / "placeholder" / "all skipped (dedup)" / "error: ..."}
```

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
`browser_close`) before the next starts. Use a `for` loop in the Workflow
script, **not** `pipeline()` or `parallel()`.

Each agent only receives staged keys for its own venue, so its prompt stays
short. (Crash recovery is the same as a normal re-run — see "How to invoke".)
