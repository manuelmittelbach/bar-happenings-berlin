// Canonical workflow for the visual scrape of all active venue event pages.
//
// This file is the single, version-controlled orchestration script for the
// runbook scripts/VISUAL_SCRAPE_WORKFLOW.md. Run it via the Workflow tool's
// `scriptPath` instead of hand-writing a new workflow each time — that keeps the
// system's most important invariant hard-wired so it can't drift between runs:
//
//   SEQUENTIAL. Venues are scraped one at a time in a `for` loop, NEVER
//   pipeline()/parallel(). The Playwright MCP server shares ONE browser tab
//   across the whole session; concurrent agents interleave navigate/evaluate
//   calls and silently read each other's pages, producing wrong scraped data
//   (this really happened — see the "Shared browser" section in the runbook).
//
// Each sub-agent does its own DB writes (runs import_visual_events.py, or
// stage_visual_placeholder.py when it found nothing). This script only
// orchestrates — it never touches the database directly.
//
// Best-effort by design (see memory feedback_scraper_best_effort): a single
// venue erroring out does NOT stop the fleet. The loop logs it and moves on.
//
// Invoke (after running Step 1 of the runbook to produce the venues JSON). All
// args are OPTIONAL — with none passed, `today`/`windowEnd` are resolved via a
// setup agent and `venues` is loaded from /tmp/visual_scrape_venues.json, so
// this is enough:
//   Workflow({ scriptPath: "scripts/visual-scrape.workflow.js" })
// Passing them explicitly still works and skips the fallbacks:
//   Workflow({
//     scriptPath: "scripts/visual-scrape.workflow.js",
//     args: { today: "<currentDate>", windowEnd: "<currentDate + 14d>",
//             venues: [ ...parsed /tmp/visual_scrape_venues.json ] }
//   })

export const meta = {
  name: 'visual-scrape',
  description: 'Visually scrape every active venue event page into venue_events_staging (sequential)',
  phases: [
    { title: 'Scrape', detail: 'One sub-agent per venue, sequentially — scrape, then import or stage a placeholder' },
  ],
}

const WORKDIR = '/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin'
const VENUES_FILE = '/tmp/visual_scrape_venues.json'

// What each sub-agent returns. status is free-text (the importer's outcome) —
// we deliberately do NOT add hard insert-error STOP logic (best-effort stance).
const VENUE_RESULT_SCHEMA = {
  type: 'object',
  required: ['venue_name', 'status'],
  properties: {
    venue_name: { type: 'string' },
    status:     { type: 'string' },
  },
}

// --- Inputs (from args, with fallbacks) -------------------------------------
// The workflow runtime has no Date/filesystem/MCP access, so setup agents
// resolve anything not passed in `args`. The normal path passes all three and
// spawns zero setup agents.
let today = (args && args.today) || ''
let windowEnd = (args && args.windowEnd) || ''
let venues = (args && Array.isArray(args.venues) && args.venues.length > 0) ? args.venues : []

// today fallback: resolve via the shell.
if (!today) {
  log('args.today absent — resolving today via setup agent (date +%F)…')
  const resolved = await agent(
    'Run `date +%F` and return ONLY the resulting date in YYYY-MM-DD format — no other text.',
    { label: 'resolve-today' }
  )
  today = (resolved || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error('Could not resolve today from setup agent (got: ' + JSON.stringify(resolved) + ').')
  }
  log(`Resolved today = ${today}`)
}

// windowEnd fallback: today + 14 days, computed from the resolved `today` so the
// two stay consistent even when today came from args.
if (!windowEnd) {
  log('args.windowEnd absent — computing today + 14 days via setup agent…')
  const resolved = await agent(
    `Run exactly this and return ONLY the printed date (YYYY-MM-DD), nothing else:\n`
    + `python3 -c "from datetime import date,timedelta; print((date.fromisoformat('${today}')+timedelta(days=14)).isoformat())"`,
    { label: 'resolve-window-end' }
  )
  windowEnd = (resolved || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(windowEnd)) {
    throw new Error('Could not resolve windowEnd from setup agent (got: ' + JSON.stringify(resolved) + ').')
  }
  log(`Resolved windowEnd = ${windowEnd}`)
}

// venues fallback: load the Step 1 work-list from /tmp (large staged_keys
// payloads may be dropped if passed inline via args).
if (venues.length === 0) {
  log(`args.venues absent — loading venues from ${VENUES_FILE} via setup agent…`)
  const VENUE_SCHEMA = {
    type: 'object',
    required: ['venue_id', 'website_events'],
    properties: {
      venue_id:       { type: 'string' },
      name:           { type: ['string', 'null'] },
      website_events: { type: 'string' },
      staged_keys:    { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    },
  }
  venues = await agent(
    `Working directory: ${WORKDIR}

Read ${VENUES_FILE} (it already exists — the main session ran
"python3 scripts/visual_scrape_helper.py list --out ${VENUES_FILE}" before
launching this workflow). Return its contents as a JSON array of venue objects.`,
    { label: 'load-venues', schema: { type: 'array', items: VENUE_SCHEMA } }
  )
  if (!venues || venues.length === 0) {
    throw new Error('Setup agent returned no venues. Ensure ' + VENUES_FILE + ' was produced by running: '
      + 'python3 scripts/visual_scrape_helper.py list --out ' + VENUES_FILE)
  }
  log(`Loaded ${venues.length} active venues from file.`)
}

// --- Sub-agent prompt (mirrors the runbook's per-venue manual reference) -----
// The full per-venue procedure + field rules live in
// scripts/VISUAL_SCRAPE_FIELD_RULES.md, which the agent reads. This prompt is
// just the dispatch wrapper. Keep it in sync with the runbook's description of
// the sub-agent contract.
function subAgentPrompt(v) {
  const stagedKeys = JSON.stringify(v.staged_keys || [])
  return `Working directory: ${WORKDIR}

Read scripts/VISUAL_SCRAPE_FIELD_RULES.md — your complete per-venue manual
(scrape procedure + field rules + pre-import checklist). It is the only file
you need to read.

Today: ${today}. Window: ${today} to ${windowEnd} (inclusive).

Your venue (only this one):
  Name: ${v.name}
  ID:   ${v.venue_id}
  URL:  ${v.website_events}

Already-staged keys for this venue (skip any event whose [date, normalized
title] is in this list):
${stagedKeys}

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_wait_for,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_close"

Then:
- Step 2: navigate to the URL, extract events in [${today}, ${windowEnd}].
- If events found: write them to /tmp/visual_scrape_${v.venue_id}.json using
  python3 + json.dumps (NEVER the Write tool — German typographic quotes break
  hand-written JSON), then run:
    python3 scripts/import_visual_events.py /tmp/visual_scrape_${v.venue_id}.json
- If zero events (for any reason): run:
    python3 scripts/stage_visual_placeholder.py ${v.venue_id} ${v.website_events}
- Call browser_close when done.

Return the result object: venue_name carried through, plus a short status string
("N new + M update inserted" / "placeholder" / "all skipped (dedup)" / "error: …").`
}

// --- Scrape — STRICTLY SEQUENTIAL -------------------------------------------
// Do NOT convert this to pipeline()/parallel(): the shared browser tab makes
// concurrent runs read each other's pages. One agent finishes (incl.
// browser_close) before the next starts.
phase('Scrape')
log(`Scraping ${venues.length} venues sequentially (shared browser tab — no parallelism). `
  + `Window ${today} → ${windowEnd}.`)

const results = []
for (let i = 0; i < venues.length; i++) {
  const v = venues[i]
  log(`[${i + 1}/${venues.length}] ${v.name}`)
  const r = await agent(subAgentPrompt(v), {
    label: v.name,
    phase: 'Scrape',
    schema: VENUE_RESULT_SCHEMA,
  })
  if (r) results.push(r)
}

log(`Collected ${results.length}/${venues.length} venue results`)

// Surface anything whose status looks like an error so the orchestrator can
// mention it — best-effort, not a hard stop.
const errored = results.filter((r) => /error/i.test(r.status || ''))
const placeholders = results.filter((r) => /placeholder/i.test(r.status || ''))

return {
  summary: {
    total: results.length,
    of: venues.length,
    placeholders: placeholders.length,
    errored: errored.length,
  },
  results,
  errored: errored.map((r) => ({ venue: r.venue_name, status: r.status })),
}
