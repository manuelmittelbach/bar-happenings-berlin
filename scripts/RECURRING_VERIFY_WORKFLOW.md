# Recurring Series Verification Workflow

<!-- last-updated: 2026-05-29 → 2026-05-29 (fix: serialize browser calls) -->

Standard runbook for re-checking every **recurring event series** against its
source page with Playwright/MCP, to confirm it is *still* a regular/recurring
event. **Read-only** — it never changes the database. The output is a Markdown
report (`/tmp/recurring_verify_report.md`); you decide per flagged series in
the Admin Dashboard.

Sister workflow to `scripts/VISUAL_SCRAPE_WORKFLOW.md` — same shape (Step 1
once, then loop/fan-out per item, Step 4 cleanup), same orchestration model,
same tooling. The difference: this one *verifies existing* series rather than
*scraping new* events, and writes nothing to the DB.

## What "recurring series" means here

A **series root** is a row in the `events` table with an empty/NULL
`parent_id` AND a non-empty `recurrence` rule (`weekly`, `biweekly`,
`monthly_by_weekday`, `monthly_last_weekday`). There are ~23 of these.

Each root has many materialized **child occurrences** (`parent_id` = root id,
`recurrence` empty) that the pg_cron `extend_recurring_series` job keeps
topping up. **You only verify roots** — if the root's event no longer happens
regularly, every child derived from it is stale too. Checking children would
be 137 redundant page loads for the same answer.

## How to invoke (from a fresh Claude Code session)

This is a Playwright-heavy sweep (~23 browser sessions, run **sequentially**).
Switch to Sonnet —
same quality for this task, much lower token cost than Opus:

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
itself. Load with a single `ToolSearch` call (the `query` must be **one
line** — split here for readability only):

```
ToolSearch query="select:mcp__supabase__execute_sql,mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close"
```

## Step-by-step instructions

**Overall shape:** Step 1 once at the start (load series roots). Then **per
series**: Step 2 (visit page + judge) → collect one verdict object. Step 3
(write report) once at the end. Step 4 (cleanup) once at the end. Nothing is
written to the DB at any point.

> **For the full run (all 23 series):** the per-series logic below is what
> each **sub-agent** follows for its own series. The main orchestrator does
> Step 1, runs one sub-agent per series **sequentially**, collects verdict
> objects, then does Step 3 + Step 4 — see "Orchestration model".

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

### Step 2 — Verify ONE series

Start of the per-series loop. For the current series:

```
mcp__playwright__browser_navigate → the series' `url`
mcp__playwright__browser_evaluate → '() => document.body.innerText'
```

Then judge whether the page still shows this event as a recurring/regular
occurrence. Look for, in order of strength:

1. **Cadence wording** that matches `cadence` — e.g. for "every Thursday":
   "every Thursday", "jeden Donnerstag", "Do. 20:00", "Thursdays", a weekly
   calendar slot on that weekday. For monthly: "2. Samstag im Monat", "every
   2nd Saturday", "monatlich", etc. German pages are the norm — match German
   phrasings too.
2. **The event title** (or a close variant) appearing as a regular/series
   item, even if the exact cadence isn't restated in words.
3. A **future-dated occurrence** of this event consistent with the rule
   (e.g. the title appears on an upcoming date that falls on the right
   weekday), which corroborates the series is alive.

Tips (mirrors the visual-scrape runbook):
- `document.body.innerText` is cleaner than HTML — use it as the primary text.
- If `innerText` is sparse (< ~200 chars): check for an **iframe**
  (`document.querySelectorAll('iframe')` → navigate to its `src`, e.g.
  Donau115's Google Sheet) or an **event image / monthly PNG**
  (`document.querySelectorAll('img')` → navigate to the image URL,
  `browser_take_screenshot`, then `Read` the screenshot to judge visually,
  e.g. Jatz Bar).
- Instagram-post URLs (`instagram.com/p/...`) often block bots — if you get a
  login wall or empty body, that's `unreachable`, not `not_found`.
- If the page fails (timeout, 404, anti-bot block): retry **once**, then mark
  `unreachable` and move on.

#### Choose exactly one verdict

| verdict          | when |
|------------------|------|
| `confirmed`      | Cadence wording (signal 1) OR a rule-consistent future occurrence (signal 3) clearly present. The series is alive and matches the stored rule. |
| `confirmed_weak` | Title present as a regular item (signal 2) but the page doesn't restate the cadence and you couldn't confirm a matching future date. Probably fine, low confidence. |
| `changed`        | The event is clearly still recurring **but on a different day/cadence** than `cadence` (e.g. moved from Thursday to Friday, weekly → monthly). Note old vs. new in `evidence`. |
| `not_found`      | The page loaded fine and is the right page, but this event is **not** on it as a recurring item (only one-off concerts, or it's gone entirely). Candidate for removal. |
| `unreachable`    | Page failed to load / blocked / login wall / OCR failed. **Inconclusive** — never infer removal from a page you couldn't read. |

**Bias rules:**
- When torn between `confirmed` and `not_found`, and the page loaded but you're
  unsure → `confirmed_weak`, never `not_found`. A false `not_found` risks
  deleting a live series; a false `confirmed_weak` just means the admin
  double-checks.
- Never return `not_found` for a page you couldn't actually read — that's
  `unreachable`.

#### Build the verdict object

For each series return exactly this shape (carry through `id`, `title`,
`venue`, `url`, `cadence` from Step 1 so the report is self-describing):

```json
{
  "id": "7922a42d-...",
  "title": "House of Spice Cabaret",
  "venue": "800A Bar & Cabaret",
  "url": "https://www.800aberlin.com/#events",
  "cadence": "2nd Saturday of each month",
  "verdict": "confirmed",
  "evidence": "Page lists \"House of Spice Cabaret — every 2nd Saturday\" with next date 2026-06-13"
}
```

`evidence` is a **short** quote/paraphrase of what you actually saw on the page
that justifies the verdict (1–2 lines). For `changed`, state old vs. new. For
`unreachable`, state the failure (e.g. "403 anti-bot", "Instagram login wall").

### Step 3 — Write the report (once, at the end)

Collect every series' verdict object into one JSON array and write it to a
file, then render the report. **Use `python3 + json.dumps`, never the `Write`
tool directly** — German typographic quotes (`„…"`) in evidence will silently
break hand-written JSON.

```python
python3 << 'EOF'
import json
results = [ /* all verdict objects */ ]
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

1. Close the browser (single-session runs only — in the orchestration model
   each sub-agent closes its own):
   ```
   mcp__playwright__browser_close
   ```
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

### Orchestrator flow (replaces the per-series loop after Step 1)

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

> **No `browser_close` in the main session** — each agent closes its own.

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

Fill in `{TODAY}` and the one series' fields. Project root is
`/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin`.

```
Working directory: /Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin

Read scripts/RECURRING_VERIFY_WORKFLOW.md "Step 2" for the verdict rules.

Today: {TODAY}.

Series to verify (only this one):
  id:       {id}
  title:    {title}
  venue:    {venue}
  cadence:  {cadence}        (the stored recurrence rule, human-readable)
  url:      {url}

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close,mcp__playwright__browser_take_screenshot"

Then:
- Navigate to the url, read document.body.innerText (handle iframe / image
  fallbacks per Step 2 if the body is sparse).
- Decide if "{title}" is still a recurring event matching "{cadence}".
- Pick exactly one verdict: confirmed | confirmed_weak | changed | not_found
  | unreachable. Apply the bias rules: never not_found for a page you couldn't
  read (that's unreachable); when unsure but the page loaded, confirmed_weak.
- Call browser_close when done.

Return the verdict object (id/title/venue/url/cadence carried through verbatim,
plus verdict + a 1-2 line evidence quote of what you saw).
```

## Rules & constraints

- **Read-only.** Never INSERT/UPDATE/DELETE any `events` row. The whole point
  is a report the admin acts on by hand.
- Verify **roots only** (parent_id empty + recurrence set) — never children.
- Exactly one verdict per series, from the fixed vocabulary.
- `unreachable` ≠ `not_found`. Never infer a series is dead from a page you
  couldn't load. Better a retry next run than a wrongly-flagged live series.
- Bias toward keeping: when the page loaded but you're unsure, `confirmed_weak`.
- `evidence` must quote/paraphrase what was actually on the page — never invent.
- Match **German** cadence phrasings, not just English (most pages are German).
- Don't follow links to impressum/privacy/third-party ticketing — judge from
  the venue's own event page (the stored `url`).
```
