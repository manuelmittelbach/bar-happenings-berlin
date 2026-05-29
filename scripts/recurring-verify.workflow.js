// Canonical workflow for the recurring-series verification sweep.
//
// This file is the single, version-controlled orchestration script for the
// runbook scripts/RECURRING_VERIFY_WORKFLOW.md. Run it via the Workflow tool's
// `scriptPath` instead of hand-writing a new workflow each time — that keeps two
// invariants hard-wired so they can't drift between runs:
//
//   1. SEQUENTIAL. Series are verified one at a time in a `for` loop, NEVER
//      pipeline()/parallel(). The Playwright MCP server shares ONE browser tab
//      across the whole session; concurrent agents interleave navigate/evaluate
//      calls and silently read each other's pages (this really happened — see
//      the "Shared browser" section in the runbook).
//   2. DYNAMIC ROOTS. The series list is read from /tmp/recurring_roots.json
//      (produced by `verify_recurring_helper.py list`) — never hardcoded, so
//      new/removed series are always picked up.
//
// Read-only end to end: no DB writes. The only output is the Markdown report at
// /tmp/recurring_verify_report.md, which the admin acts on by hand.
//
// Invoke (after running Step 1 of the runbook to produce the roots JSON). Both
// args are OPTIONAL — with none passed, `today` falls back to `date +%F` and
// `roots` to /tmp/recurring_roots.json, so this is enough:
//   Workflow({ scriptPath: "scripts/recurring-verify.workflow.js" })
// Passing them explicitly still works and skips the fallbacks:
//   Workflow({
//     scriptPath: "scripts/recurring-verify.workflow.js",
//     args: { today: "<currentDate>", roots: [ ...parsed /tmp/recurring_roots.json ] }
//   })

export const meta = {
  name: 'recurring-series-verify',
  description: 'Verify every recurring event series against its source page (read-only, sequential)',
  phases: [
    { title: 'Verify', detail: 'One sub-agent per series, sequentially, navigates and judges its page' },
    { title: 'Report', detail: 'Write results JSON and render the Markdown report' },
  ],
}

const WORKDIR = '/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin'

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'venue', 'url', 'cadence', 'verdict', 'evidence'],
  properties: {
    id:       { type: 'string' },
    title:    { type: 'string' },
    venue:    { type: 'string' },
    url:      { type: 'string' },
    cadence:  { type: 'string' },
    verdict:  { type: 'string', enum: ['confirmed', 'confirmed_weak', 'changed', 'not_found', 'unreachable'] },
    evidence: { type: 'string' },
  },
}

// --- Inputs (from args) -----------------------------------------------------
// Both inputs are OPTIONAL: the workflow is self-sufficient and can run with no
// `args` at all. `today` falls back to `date +%F` via a setup agent; `roots`
// falls back to /tmp/recurring_roots.json (Step 1's output). Passing them in
// `args` still works and skips the fallbacks.
let today = (args && args.today) || ''
let roots = (args && Array.isArray(args.roots) && args.roots.length > 0) ? args.roots : []

// today fallback: the workflow runtime has no Date access, so a setup agent
// resolves the current date via the shell.
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

// If roots weren't passed in args (large payload may be dropped by the runtime),
// fall back to loading them from /tmp/recurring_roots.json via a setup agent.
// The helper must have been run in the main session before invoking the workflow.
if (roots.length === 0) {
  log('args.roots absent — loading roots from /tmp/recurring_roots.json via setup agent…')
  const ROOT_SCHEMA = {
    type: 'object',
    required: ['id', 'title', 'venue', 'cadence'],
    properties: {
      id:          { type: 'string' },
      title:       { type: 'string' },
      venue:       { type: 'string' },
      cadence:     { type: 'string' },
      url:         { type: ['string', 'null'] },
      freq:        { type: 'string' },
      anchor_date: { type: 'string' },
      until:       { type: ['string', 'null'] },
      venue_id:    { type: 'string' },
    },
  }
  roots = await agent(
    `Working directory: ${WORKDIR}

Read /tmp/recurring_roots.json (it already exists — the main session ran
"python3 scripts/verify_recurring_helper.py list" before launching this workflow).
Return its contents as a JSON array of recurring series root objects.`,
    { label: 'load-roots', schema: { type: 'array', items: ROOT_SCHEMA } }
  )
  if (!roots || roots.length === 0) {
    throw new Error('Setup agent returned no roots. Ensure /tmp/recurring_roots.json '
      + 'was produced by running: '
      + 'python3 scripts/verify_recurring_helper.py list --out /tmp/recurring_roots.json')
  }
  log(`Loaded ${roots.length} series roots from file.`)
}

// --- Sub-agent prompt (mirrors the runbook's "Sub-agent prompt template") ---
// Kept in sync with scripts/RECURRING_VERIFY_WORKFLOW.md — edit the judging
// rules in BOTH places, or the runbook stops being the source of truth.
function subAgentPrompt(r) {
  return `Working directory: ${WORKDIR}

You verify ONE recurring event series against its source page. Read-only: do
not touch any database.

Today: ${today}.

Series to verify (only this one):
  id:       ${r.id}
  title:    ${r.title}
  venue:    ${r.venue}
  cadence:  ${r.cadence}        (the stored recurrence rule, human-readable)
  url:      ${r.url}

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close,mcp__playwright__browser_take_screenshot"

Steps:
1. browser_navigate to the url, then browser_evaluate '() => document.body.innerText'.
2. If the body is sparse (< ~200 chars): check document.querySelectorAll('iframe')
   — if present, navigate to its src (e.g. a Google Sheet) — or
   document.querySelectorAll('img') for an event image / monthly PNG: navigate
   to the image URL, browser_take_screenshot, then Read the screenshot to judge
   visually. Instagram-post URLs (instagram.com/p/...) often show a login wall
   or empty body → that is \`unreachable\`, not \`not_found\`.
3. If the page fails (timeout / 404 / anti-bot): retry ONCE, then \`unreachable\`.
4. Judge whether "${r.title}" still appears as a recurring event matching
   "${r.cadence}". Signals, strongest first:
     a. Cadence wording matching ${r.cadence} — match GERMAN phrasings too
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
plus \`verdict\` and a 1–2 line \`evidence\` quote of what you actually saw (for
\`changed\`: old vs. new; for \`unreachable\`: the failure, e.g. "403 anti-bot").`
}

// --- Phase 1: Verify — STRICTLY SEQUENTIAL ----------------------------------
// Do NOT convert this to pipeline()/parallel(): the shared browser tab makes
// concurrent runs read each other's pages. One agent finishes (incl.
// browser_close) before the next starts.
phase('Verify')
log(`Verifying ${roots.length} recurring series sequentially (shared browser tab — no parallelism)…`)

const results = []
for (let i = 0; i < roots.length; i++) {
  const r = roots[i]
  log(`[${i + 1}/${roots.length}] ${r.title} @ ${r.venue}`)
  const v = await agent(subAgentPrompt(r), {
    label: `verify:${r.title}`,
    phase: 'Verify',
    schema: VERDICT_SCHEMA,
  })
  if (v) results.push(v)
}

log(`Collected ${results.length}/${roots.length} verdicts`)

// --- Phase 2: Report --------------------------------------------------------
phase('Report')

const by = (verdict) => results.filter((v) => v.verdict === verdict)
const confirmed = by('confirmed')
const confirmed_weak = by('confirmed_weak')
const changed = by('changed')
const not_found = by('not_found')
const unreachable = by('unreachable')

log(`confirmed=${confirmed.length}, confirmed_weak=${confirmed_weak.length}, `
  + `changed=${changed.length}, not_found=${not_found.length}, unreachable=${unreachable.length}`)

// The workflow runtime has no filesystem access, so an agent writes the results
// JSON (via python3 — never a hand-written file, German typographic quotes break
// it) and runs the report helper.
const reportOut = await agent(
  `Working directory: ${WORKDIR}

Write this JSON array to /tmp/recurring_verify_results.json using python3 (NOT the
Write tool — German quotes in evidence would break hand-written JSON), then render
the report.

Run exactly this (heredoc):
python3 << 'PYEOF'
import json
results = ${JSON.stringify(results)}
with open('/tmp/recurring_verify_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print('wrote', len(results), 'results')
PYEOF

Then run:
  python3 scripts/verify_recurring_helper.py report /tmp/recurring_verify_results.json

Return the stdout of both commands verbatim.`,
  { label: 'write-report', phase: 'Report' }
)

log('Report written to /tmp/recurring_verify_report.md')

return {
  summary: {
    total: results.length,
    confirmed: confirmed.length,
    confirmed_weak: confirmed_weak.length,
    changed: changed.length,
    not_found: not_found.length,
    unreachable: unreachable.length,
    needs_review: changed.length + not_found.length,
  },
  flagged: [...changed, ...not_found].map((v) => ({
    title: v.title, venue: v.venue, verdict: v.verdict, evidence: v.evidence,
  })),
  unreachable: unreachable.map((v) => ({ title: v.title, venue: v.venue, evidence: v.evidence })),
  report_output: reportOut,
}
