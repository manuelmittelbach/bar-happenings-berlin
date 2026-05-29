# Recurring Series Verification Workflow

<!-- last-updated: 2026-05-29 (template is the single source of truth for judging rules; Step 2 + Rules trimmed to overview, removed duplication) -->

Standard runbook for re-checking every **recurring event series** against its
source page with Playwright/MCP, to confirm it is *still* a regular/recurring
event. **Read-only** — it never changes the database. The output is a Markdown
report (`/tmp/recurring_verify_report.md`); you decide per flagged series in
the Admin Dashboard.

Designed to be self-contained — read this file in a fresh session and you have
everything needed to execute the workflow. You do not need to open any other
runbook.

## What "recurring series" means here

A **series root** is an **approved** row in the `events` table (`status =
approved`) with an empty/NULL `parent_id` AND a non-empty `recurrence` rule
(`weekly`, `biweekly`, `monthly_by_weekday`, `monthly_last_weekday`). There are
~23 of these. (The Step 1 helper applies exactly this filter.)

Each root has many materialized **child occurrences** (`parent_id` = root id,
`recurrence` empty) that the pg_cron `extend_recurring_series` job keeps
topping up. **You only verify roots** — if the root's event no longer happens
regularly, every child derived from it is stale too. Checking children would
be 137 redundant page loads for the same answer.

## How to invoke (from a fresh Claude Code session)

This is a Playwright-heavy sweep (~23 browser sessions, run **sequentially**).
Switch to Sonnet — same quality for this task, much lower token cost than Opus:

```
/model
```
→ pick `sonnet-4-6` (or whichever Sonnet is current).

Then paste:

> Read `scripts/RECURRING_VERIFY_WORKFLOW.md` and execute the workflow for all
> recurring series.

`today` comes from the `currentDate` in memory — pass it as `args` when
invoking the Workflow tool so sub-agents can reason about whether a date that
"should" be coming up is actually still listed.

**Crash recovery:** the workflow is read-only and idempotent — just re-run the
same prompt. Nothing is persisted mid-run except the final report, so a crash
costs nothing but the re-scrape of unfinished series.

### Tools you'll need (deferred — load before using)

Playwright + Supabase MCP tools are deferred in fresh sessions. The
orchestrator only needs Supabase (for Step 1); each sub-agent loads Playwright
itself (see the sub-agent template). So in the main session, load just:

```
ToolSearch query="select:mcp__supabase__execute_sql"
```

## Step-by-step instructions

**Map of the run:** the orchestrator does **Step 1** once (load series roots),
then spawns **one sub-agent per series**. **The hard rule: one agent = one
series.** Each agent visits its series' page, judges it, and returns one verdict
object (Step 2 is the overview; the exact prompt it runs is the sub-agent
template under "Orchestration model"). The orchestrator collects all verdicts,
then does **Step 3** (write report) and **Step 4** (cleanup) once at the end.
Nothing is written to the DB at any point.

### Step 1 — Load the recurring series roots

Run the helper (it queries Supabase project `uybvrxqleutguucrifuf` via
`scripts/.env`):

```
python3 scripts/verify_recurring_helper.py list --out /tmp/recurring_roots.json
```

This writes a JSON array, one object per series root:

```json
{
  "id": "7922a42d-...",
  "title": "House of Spice Cabaret",
  "venue": "800A Bar & Cabaret",
  "venue_id": "872c9dda-...",
  "anchor_date": "2026-05-09",
  "freq": "monthly_by_weekday",
  "until": null,
  "cadence": "2nd Saturday of each month",
  "url": "https://www.800aberlin.com/#events"
}
```

`cadence` is the human-readable rule (computed the same way the app's
`describeRule()` does) — this is the thing you're checking the page still
agrees with. `until` is the series end date (`null` = indefinite).

### Step 2 — Verify your series (overview)

Each sub-agent visits its one series' `url` and judges whether the page still
shows the event as recurring on its stored `cadence`, then returns exactly one
verdict:

- `confirmed` — still recurring and matches the stored rule.
- `confirmed_weak` — title present as a regular item, but the cadence isn't
  restated and no matching future date is confirmed. Low confidence, probably fine.
- `changed` — still recurring, but on a different day/cadence than stored.
- `not_found` — page loaded fine but the event is no longer on it as a recurring
  item. Candidate for removal.
- `unreachable` — page failed / blocked / login wall / OCR failed. Inconclusive.

**Keep-bias (critical):** when the page loaded but you're unsure, choose
`confirmed_weak`, **never** `not_found` — a false `not_found` risks deleting a
live series. And never `not_found` for a page you couldn't actually read; that's
`unreachable`.

The **exact operative spec each agent runs** — navigation, iframe/image
fallbacks, the strength-ordered signals, and the precise per-verdict criteria —
is the **"Sub-agent prompt template"** below, which is the single source of
truth for the judging rules. This section is just the overview.

### Step 3 — Write the report (once, at the end)

Collect every series' verdict object into one JSON array and write it to a
file, then render the report. **Use `python3 + json.dumps`, never the `Write`
tool directly** — German typographic quotes (`„…"`) in evidence will silently
break hand-written JSON.

```python
python3 << 'EOF'
import json
results = [
    # one verdict object per series — paste the full list here
]
with open('/tmp/recurring_verify_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
EOF
```

Then:

```
python3 scripts/verify_recurring_helper.py report /tmp/recurring_verify_results.json
```

It writes `/tmp/recurring_verify_report.md` (grouped by verdict) and prints a
summary line + how many series need admin review (`not_found` + `changed`).
**Relay that summary to the user and point them at the report file.** Do NOT
change any database rows — the admin acts on the report manually in the
dashboard.

### Step 4 — Cleanup (once, at the end)

After all sub-agents are done, in the main session:

1. **No `browser_close` needed in the main session** — the main session never
   opens a browser; each sub-agent already closed its own at the end of its run.
2. Optional: remove Playwright MCP cache files:
   ```
   rm -f .playwright-mcp/page-*.yml .playwright-mcp/console-*.log
   ```

## Orchestration model

### ⚠ Shared browser — no parallel browser calls

The Playwright MCP server runs **one browser with one current tab** shared
across every tool call in the session. Running multiple browser agents
concurrently causes agents to interleave `browser_navigate` /
`browser_evaluate` calls on the same tab — agent A navigates to URL_A,
agent B navigates to URL_B before A reads, and A silently reads URL_B's
content and produces a wrong verdict.

This bug surfaced in practice: in a 23-agent parallel run, the Degendorff
agent read Froschkönig's content, the Donau115 agent read Casino for Social
Medicine's content, and the KikiSol agent read Sandmann's content — all
because those venues were concurrently navigated by other agents.

**Always run venue agents sequentially** — one finishes (including
`browser_close`) before the next starts. Use a `for` loop, **not**
`pipeline()` or `parallel()`.

For the full run, the Workflow tool spawns **one sub-agent per series
sequentially**. Each agent handles exactly one series, so browser content
never accumulates and peak context stays low.

### Orchestrator flow (main session)

1. Run Step 1 in the main session → `/tmp/recurring_roots.json`.
2. Read that JSON. Spawn **one agent per root sequentially** via a `for`
   loop — **not** `pipeline()`:
   ```js
   const results = []
   for (const r of roots) {
     const v = await agent(subAgentPrompt(r), { schema: VERDICT_SCHEMA })
     if (v) results.push(v)
   }
   ```
   The schema forces each agent to return a validated verdict object (no
   parsing needed).
3. Collect the verdict objects.
4. Write them to `/tmp/recurring_verify_results.json` and run Step 3's
   `report` command.
5. Relay the summary; link the report.
6. Run Step 4 cleanup in the main session.

### Sub-agent schema (StructuredOutput)

```json
{
  "type": "object",
  "required": ["id", "title", "venue", "url", "cadence", "verdict", "evidence"],
  "properties": {
    "id":       {"type": "string"},
    "title":    {"type": "string"},
    "venue":    {"type": "string"},
    "url":      {"type": "string"},
    "cadence":  {"type": "string"},
    "verdict":  {"type": "string", "enum": ["confirmed","confirmed_weak","changed","not_found","unreachable"]},
    "evidence": {"type": "string"}
  }
}
```

### Sub-agent prompt template

Self-contained on purpose — the agent needs **no file reads**. Fill in
`{TODAY}` and the one series' fields. **This template is the single source of
truth for the judging rules** (Step 2 above is just the overview) — edit verdict
semantics here.

```
Working directory: /Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin

You verify ONE recurring event series against its source page. Read-only: do
not touch any database.

Today: {TODAY}.

Series to verify (only this one):
  id:       {id}
  title:    {title}
  venue:    {venue}
  cadence:  {cadence}        (the stored recurrence rule, human-readable)
  url:      {url}

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close,mcp__playwright__browser_take_screenshot"

Steps:
1. browser_navigate to the url, then browser_evaluate '() => document.body.innerText'.
2. If the body is sparse (< ~200 chars): check document.querySelectorAll('iframe')
   — if present, navigate to its src (e.g. a Google Sheet) — or
   document.querySelectorAll('img') for an event image / monthly PNG: navigate
   to the image URL, browser_take_screenshot, then Read the screenshot to judge
   visually. Instagram-post URLs (instagram.com/p/...) often show a login wall
   or empty body → that is `unreachable`, not `not_found`.
3. If the page fails (timeout / 404 / anti-bot): retry ONCE, then `unreachable`.
4. Judge whether "{title}" still appears as a recurring event matching
   "{cadence}". Signals, strongest first:
     a. Cadence wording matching {cadence} — match GERMAN phrasings too
        ("jeden Donnerstag", "2. Samstag im Monat", "monatlich", "Do. 20:00").
     b. The title (or close variant) present as a regular/series item.
     c. A future-dated occurrence consistent with the rule (right weekday/date).
5. Pick EXACTLY ONE verdict:
     confirmed       — signal (a) or (c) clearly present; alive & matches rule.
     confirmed_weak  — only signal (b); cadence not restated, no matching future
                       date confirmed. Probably fine, low confidence.
     changed         — clearly still recurring but on a DIFFERENT day/cadence
                       (note old vs. new in evidence).
     not_found       — page loaded, right page, but the event is NOT on it as a
                       recurring item (only one-offs, or gone). Review for removal.
     unreachable     — page failed / blocked / login wall / OCR failed.
                       INCONCLUSIVE — never infer removal from a page you couldn't read.
   Bias rules: when the page loaded but you're unsure → confirmed_weak, NEVER
   not_found (a false not_found risks deleting a live series). Never not_found
   for a page you couldn't actually read — that's unreachable.
6. browser_close.

Return the verdict object: id/title/venue/url/cadence carried through verbatim,
plus `verdict` and a 1–2 line `evidence` quote of what you actually saw (for
`changed`: old vs. new; for `unreachable`: the failure, e.g. "403 anti-bot").
```

## Rules & constraints

Orchestrator-level invariants (the per-verdict judging rules live in the
sub-agent template):

- **Read-only.** Never INSERT/UPDATE/DELETE any `events` row — the output is a
  report the admin acts on by hand.
- Verify **roots only** (approved, `parent_id` empty, `recurrence` set) — never
  children. The Step 1 helper enforces this.
- One verdict per series from the fixed vocabulary; `evidence` must come from
  the page, never invented.
