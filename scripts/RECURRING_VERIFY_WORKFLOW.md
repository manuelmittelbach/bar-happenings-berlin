# Recurring Series Verification Workflow

<!-- last-updated: 2026-05-29 (canonical workflow script scripts/recurring-verify.workflow.js is now the single source of truth for the sub-agent prompt + sequential/dynamic-roots invariants; runbook references it instead of duplicating) -->

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
then runs the **canonical workflow script** `scripts/recurring-verify.workflow.js`
which spawns **one sub-agent per series, sequentially**. **The hard rule: one
agent = one series, run one at a time.** Each agent visits its series' page,
judges it, and returns one verdict object (Step 2 is the overview; the exact
prompt it runs is the sub-agent template under "Orchestration model"). The
script collects all verdicts, then does **Step 3** (write report) itself; you
do **Step 4** (cleanup) once at the end. Nothing is written to the DB at any
point.

> **Do not hand-write a new workflow each run.** The sequential loop and the
> dynamic roots list are hard-wired in `scripts/recurring-verify.workflow.js`
> precisely so they can't drift. Run that file via the Workflow tool's
> `scriptPath`; only edit the script itself if the logic genuinely changes.

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
lives in `subAgentPrompt()` inside `scripts/recurring-verify.workflow.js`, which
is the **single source of truth for the judging rules**. This section is just the
human-facing overview. To change judging semantics, edit `subAgentPrompt()`.

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
2. Read that JSON into memory.
3. Invoke the **canonical workflow script** via the Workflow tool's `scriptPath`,
   passing `today` and the parsed roots as `args`:
   ```js
   Workflow({
     scriptPath: "scripts/recurring-verify.workflow.js",
     args: { today: "<currentDate>", roots: [ /* parsed /tmp/recurring_roots.json */ ] },
   })
   ```
   The script runs **one agent per root in a strictly sequential `for` loop**
   (never `pipeline()`/`parallel()` — see the shared-browser warning above),
   forces each agent to return a schema-validated verdict, then writes the
   results JSON and runs Step 3's `report` command itself.
4. The script returns a summary object (counts + flagged/unreachable series) and
   the report helper's stdout. Relay the summary; link the report at
   `/tmp/recurring_verify_report.md`.
5. Run Step 4 cleanup in the main session.

> **Crash recovery / re-run:** the script is read-only and idempotent. To resume
> a partial run, relaunch with the same `scriptPath` plus `resumeFromRunId` —
> completed series return from cache, only unfinished ones re-scrape. A plain
> re-run (no resume) simply re-scrapes everything; harmless, just slower.

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

### Sub-agent prompt — lives in code (single source of truth)

The exact prompt each sub-agent runs is **not duplicated here** — it is
`subAgentPrompt()` in `scripts/recurring-verify.workflow.js`. That function is
the authoritative judging spec; keeping the only copy in the script that
actually runs means it can't silently drift from a prose copy.

What that prompt does (read the function for the verbatim text):

- Navigates to the series `url`, reads `document.body.innerText`.
- Sparse-body fallbacks: follow an `iframe` `src` (e.g. a Google Sheet), or
  screenshot an event-image / monthly PNG and judge it visually. Instagram-post
  URLs (login wall / empty body) → `unreachable`, not `not_found`.
- On load failure (timeout / 404 / anti-bot): retry ONCE, then `unreachable`.
- Judges by signals, strongest first: (a) cadence wording matching the stored
  rule — German phrasings included — (b) title present as a regular item,
  (c) a future-dated occurrence consistent with the rule.
- Picks exactly one verdict with the **keep-bias**: unsure but page loaded →
  `confirmed_weak`, never `not_found`; page unreadable → `unreachable`.
- Closes the browser, returns the schema-validated verdict object.

To change the judging rules, edit `subAgentPrompt()` — there is nothing to keep
in sync.

## Rules & constraints

Orchestrator-level invariants (the per-verdict judging rules live in the
sub-agent template):

- **Read-only.** Never INSERT/UPDATE/DELETE any `events` row — the output is a
  report the admin acts on by hand.
- Verify **roots only** (approved, `parent_id` empty, `recurrence` set) — never
  children. The Step 1 helper enforces this.
- One verdict per series from the fixed vocabulary; `evidence` must come from
  the page, never invented.
