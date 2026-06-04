// Workflow: discover each venue's canonical EVENTS PAGE URL and stage it for
// venues.website_events.
//
// Sibling of recurring-verify.workflow.js, but a DISCOVERY pass rather than a
// verification pass: these venues have NO events rows yet. For each venue we
// open its website, hunt for the page that lists its events (Programm /
// Veranstaltungen / Kalender / Konzerte / ...), judge whether real events are
// there, and return the canonical URL of the page where ALL the events live.
//
// Two invariants are hard-wired (same reasons as recurring-verify):
//   1. SEQUENTIAL. One sub-agent at a time in a `for` loop, NEVER
//      pipeline()/parallel(). The Playwright MCP server shares ONE browser tab
//      across the session; concurrent agents read each other's pages.
//   2. DYNAMIC TARGETS. The venue list is read from
//      /tmp/venue_discover_targets.json (id, name, website) — never hardcoded.
//
// Read-only against the DB: the only output is the candidates JSON at
// /tmp/venue_events_page_candidates.json. The main session reviews it and runs
//   python3 scripts/apply_events_page_urls.py /tmp/venue_events_page_candidates.json
// to write venues.website_events (non-destructive, only where currently NULL).
//
// Invoke (targets file must exist first):
//   Workflow({ scriptPath: "scripts/venue-events-page-discover.workflow.js" })
// Optionally pass targets inline:
//   Workflow({ scriptPath: "...", args: { targets: [ {id,name,website}, ... ] } })

export const meta = {
  name: 'venue-events-page-discover',
  description: 'Find each venue\'s canonical events-page URL from its website (sequential, read-only DB)',
  phases: [
    { title: 'Discover', detail: 'One sub-agent per venue, sequentially, browses the site and locates the events page' },
    { title: 'Stage', detail: 'Write the candidates JSON for apply_events_page_urls.py' },
  ],
}

const WORKDIR = '/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin'

const RESULT_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'website', 'has_events', 'events_page_url', 'page_type', 'evidence'],
  properties: {
    id:              { type: 'string' },
    name:            { type: 'string' },
    website:         { type: 'string' },
    has_events:      { type: 'boolean' },
    // The canonical page listing ALL of the venue's events. null when no events
    // page was found (has_events=false), or when the site was unreachable.
    events_page_url: { type: ['string', 'null'] },
    // root      — the events live on the website's start page itself
    // listing   — a dedicated events/programme/calendar page lists them
    // climbed   — landed on a single-event detail page, returned its parent listing
    // none      — no events found anywhere on the site
    // unreachable — site failed to load / blocked
    page_type:       { type: 'string', enum: ['root', 'listing', 'climbed', 'none', 'unreachable'] },
    evidence:        { type: 'string' },
  },
}

// --- Inputs ----------------------------------------------------------------
// targets is OPTIONAL: falls back to /tmp/venue_discover_targets.json (a JSON
// array of {id, name, website}) loaded by a setup agent.
let targets = (args && Array.isArray(args.targets) && args.targets.length > 0) ? args.targets : []

if (targets.length === 0) {
  log('args.targets absent — loading from /tmp/venue_discover_targets.json via setup agent…')
  const TARGET_SCHEMA = {
    type: 'object',
    required: ['id', 'name', 'website'],
    properties: {
      id:      { type: 'string' },
      name:    { type: 'string' },
      website: { type: ['string', 'null'] },
    },
  }
  const loaded = await agent(
    `Working directory: ${WORKDIR}

Read /tmp/venue_discover_targets.json (it already exists — the main session wrote it
before launching this workflow). Return its contents as a JSON array of venue
target objects under the key "targets". Each has id, name, website.`,
    { label: 'load-targets', schema: { type: 'object', required: ['targets'], properties: { targets: { type: 'array', items: TARGET_SCHEMA } } } }
  )
  targets = (loaded && loaded.targets) || []
  if (!targets || targets.length === 0) {
    throw new Error('Setup agent returned no targets. Ensure /tmp/venue_discover_targets.json exists '
      + 'as a JSON array of {id, name, website}.')
  }
  log(`Loaded ${targets.length} venue targets from file.`)
}

// --- Sub-agent prompt (single source of truth) -----------------------------
function subAgentPrompt(t) {
  return `Working directory: ${WORKDIR}

You investigate ONE venue's website to find the canonical page that lists its
EVENTS. Read-only: do not touch any database.

Venue (only this one):
  id:      ${t.id}
  name:    ${t.name}
  website: ${t.website}

GOAL: return the single URL of the page where this venue's events are listed —
the events OVERVIEW page, the one a visitor would bookmark to see "what's on".
NOT the URL of one individual event. If there are simply no events on the site,
return null.

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close,mcp__playwright__browser_take_screenshot"

Screenshots go to /tmp/discover-screenshots/ — create it before taking any:
  Bash: mkdir -p /tmp/discover-screenshots
Pass the full path (e.g. /tmp/discover-screenshots/${t.id}.png). Never write to
the working directory.

Steps:
1. browser_navigate to the website. If it fails (timeout / 404 / anti-bot),
   retry ONCE, then return page_type="unreachable", has_events=false,
   events_page_url=null.
2. Read the start page and enumerate its internal links to find an events page:
     browser_evaluate '() => Array.from(document.querySelectorAll("a")).map(a => ({t:(a.innerText||"").trim().slice(0,40), href:a.href})).filter(x => x.href)'
   Look for link text (German + English) such as: Programm, Veranstaltungen,
   Termine, Kalender, Events, Konzerte, Live, Shows, Spielplan, Agenda,
   "What's on", Tickets, Lineup, Club, Party. Pick the most events-like link.
   Also read the start page's own text — some venues list their programme right
   on the homepage (page_type="root").
3. EMBED CHECK (whenever events are NOT plainly visible in the top-level text).
   Many venues render their programme inside an embedded widget whose text is
   INVISIBLE to document.body.innerText (cross-origin iframes don't contribute
   text to the parent). Enumerate iframes and drill through nested ones:
     browser_evaluate '() => Array.from(document.querySelectorAll("iframe")).map(f => f.src)'
   Then for each src: browser_navigate to it, read body.innerText; if THAT page
   has iframes too (Wix/Squarespace wrap a Google Calendar TWO deep), follow one
   level deeper. calendar.google.com agenda embeds list every upcoming dated
   occurrence as plain text. If the programme is an image flyer: navigate to the
   image, browser_take_screenshot (/tmp/discover-screenshots/${t.id}.png), Read it.
   IMPORTANT: an embed is part of the host page — when events live in an embed,
   the events_page_url is the HOST page that contains the embed (the page on the
   venue's own domain), NOT the raw iframe/google-calendar src.
4. Decide page_type and events_page_url:
   - listing → a dedicated page lists multiple events (dates, recurring nights,
     concert/club programme). events_page_url = that page's URL.
   - root → the events are listed on the start page itself. events_page_url = the
     website root.
   - climbed → you landed on (or the best link led to) a SINGLE event's detail
     page. Climb UP to the parent overview that shows ALL events (the listing the
     detail page links back to, e.g. "/programm", "/events", "/veranstaltungen")
     and return THAT url, not the single-event url. page_type="climbed".
   - none → you checked the homepage, the plausible nav links, and any embeds,
     and there is genuinely no events listing (only menu / opening hours / static
     info). has_events=false, events_page_url=null.
   - unreachable → site/embed you needed could not be read. events_page_url=null.
5. A few sanity rules:
   - Prefer the venue's OWN domain over a 3rd-party ticketing host when both show
     the full programme. Only use an external host (e.g. an eventbrite/ra.co
     organiser page) if the venue's own site has NO equivalent overview.
   - Restaurants/bars with only a food menu and no event programme → none.
   - When unsure whether a page is a true listing vs. a one-off → prefer the
     broader overview page; if there is none, none.
6. browser_close.

Return the result object: id/name/website carried through verbatim, plus
has_events (boolean), events_page_url (the overview URL or null), page_type, and
a 1–2 line evidence quote of what you actually saw (e.g. the events-link text and
a couple of listed event titles/dates, or "only menu + hours, no programme").`
}

// --- Phase 1: Discover — STRICTLY SEQUENTIAL -------------------------------
// Do NOT convert to pipeline()/parallel(): the shared browser tab makes
// concurrent runs read each other's pages. One agent finishes (incl.
// browser_close) before the next starts.
phase('Discover')
log(`Discovering events pages for ${targets.length} venues sequentially (shared browser tab — no parallelism)…`)

const results = []
for (let i = 0; i < targets.length; i++) {
  const t = targets[i]
  log(`[${i + 1}/${targets.length}] ${t.name} — ${t.website}`)
  const r = await agent(subAgentPrompt(t), {
    label: `discover:${t.name}`,
    phase: 'Discover',
    schema: RESULT_SCHEMA,
  })
  if (r) results.push(r)
}

log(`Collected ${results.length}/${targets.length} results`)

// --- Phase 2: Stage --------------------------------------------------------
phase('Stage')

const found = results.filter((r) => r.events_page_url)
const none = results.filter((r) => r.page_type === 'none')
const unreachable = results.filter((r) => r.page_type === 'unreachable')

log(`found_events_page=${found.length}, none=${none.length}, unreachable=${unreachable.length}`)

// The workflow runtime has no filesystem access, so an agent writes the
// candidates JSON via python3 (German typographic quotes in evidence break
// hand-written JSON).
await agent(
  `Working directory: ${WORKDIR}

Write this JSON array to /tmp/venue_events_page_candidates.json using python3 (NOT
the Write tool — German quotes in evidence would break hand-written JSON).

Run exactly this (heredoc):
python3 << 'PYEOF'
import json
results = ${JSON.stringify(results)}
with open('/tmp/venue_events_page_candidates.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print('wrote', len(results), 'candidates')
PYEOF

Return the stdout verbatim.`,
  { label: 'write-candidates', phase: 'Stage' }
)

log('Candidates written to /tmp/venue_events_page_candidates.json')

return {
  summary: {
    total: results.length,
    found_events_page: found.length,
    none: none.length,
    unreachable: unreachable.length,
  },
  found: found.map((r) => ({ name: r.name, events_page_url: r.events_page_url, page_type: r.page_type, evidence: r.evidence })),
  none: none.map((r) => ({ name: r.name, evidence: r.evidence })),
  unreachable: unreachable.map((r) => ({ name: r.name, evidence: r.evidence })),
}
