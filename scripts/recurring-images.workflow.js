// Canonical workflow for scraping & applying cover images to recurring series.
//
// Sibling of scripts/recurring-verify.workflow.js. Where that one is read-only
// and judges whether a series still recurs, THIS one fetches a cover image for
// each recurring series from its source page and writes it onto the series.
//
// Two hard-wired invariants, identical to recurring-verify (don't drift them):
//
//   1. SEQUENTIAL. One sub-agent per series in a `for` loop, NEVER
//      pipeline()/parallel(). The Playwright MCP server shares ONE browser tab;
//      concurrent agents interleave navigate/evaluate calls and read each
//      other's pages.
//   2. DYNAMIC ROOTS. The series list comes from args / a roots JSON produced by
//      `verify_recurring_helper.py list --missing-image` — never hardcoded.
//
// Write policy (the ONLY DB writes happen in scripts/apply_recurring_images.py):
//   - Non-destructive: fills `events.image` only where it is currently NULL,
//     so existing/admin-set covers are never overwritten.
//   - Cascading: writes to the root AND its materialized child occurrences, so
//     the cover shows up on the dated occurrences in the events list.
//   - Best-effort & idempotent: a series with no suitable image is skipped; the
//     sha256 storage path upserts the same object on re-runs.
//
// Invoke (after Step 1 produces the roots JSON). Both args OPTIONAL — with none
// passed, `today` falls back to `date +%F` and `roots` to
// /tmp/recurring_image_roots.json:
//   Workflow({ scriptPath: "scripts/recurring-images.workflow.js" })
//   Workflow({
//     scriptPath: "scripts/recurring-images.workflow.js",
//     args: { today: "<currentDate>", roots: [ ...parsed roots ] }
//   })

export const meta = {
  name: 'recurring-series-images',
  description: 'Scrape a cover image per recurring series and apply it (root + children, non-destructive)',
  phases: [
    { title: 'Scrape', detail: 'One sub-agent per series, sequentially, finds the best cover image URL' },
    { title: 'Apply', detail: 'Rehost into event-images bucket and write image onto the series (only where empty)' },
  ],
}

const WORKDIR = '/Users/manuelmittelbach/Documents/Claude/Projects/bar-happenings-berlin'
const ROOTS_FILE = '/tmp/recurring_image_roots.json'
const CANDIDATES_FILE = '/tmp/recurring_image_candidates.json'

const CANDIDATE_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'venue', 'url', 'image_source_url', 'evidence'],
  properties: {
    id:               { type: 'string' },
    title:            { type: 'string' },
    venue:            { type: 'string' },
    url:              { type: 'string' },
    image_source_url: { type: ['string', 'null'] },
    evidence:         { type: 'string' },
  },
}

// --- Inputs (from args) -----------------------------------------------------
let today = (args && args.today) || ''
let roots = (args && Array.isArray(args.roots) && args.roots.length > 0) ? args.roots : []

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

if (roots.length === 0) {
  log(`args.roots absent — loading roots from ${ROOTS_FILE} via setup agent…`)
  const ROOT_SCHEMA = {
    type: 'object',
    required: ['id', 'title', 'venue'],
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
  const loaded = await agent(
    `Working directory: ${WORKDIR}

Read ${ROOTS_FILE} (it already exists — the main session ran
"python3 scripts/verify_recurring_helper.py list --missing-image --out ${ROOTS_FILE}"
before launching this workflow). Return its contents as a JSON array of
recurring series root objects under the key "roots".`,
    { label: 'load-roots', schema: { type: 'object', required: ['roots'], properties: { roots: { type: 'array', items: ROOT_SCHEMA } } } }
  )
  roots = (loaded && loaded.roots) || []
  if (!roots || roots.length === 0) {
    throw new Error(`Setup agent returned no roots. Ensure ${ROOTS_FILE} was produced by `
      + 'running: python3 scripts/verify_recurring_helper.py list --missing-image '
      + `--out ${ROOTS_FILE}`)
  }
  log(`Loaded ${roots.length} series roots (missing image) from file.`)
}

// --- Sub-agent prompt (single source of truth for image picking) ---
function subAgentPrompt(r) {
  return `Working directory: ${WORKDIR}

You find ONE cover image for ONE recurring event series. You do NOT write to any
database — just return the best image SOURCE URL (or null) for this series.

Today: ${today}.

Series:
  id:       ${r.id}
  title:    ${r.title}
  venue:    ${r.venue}
  url:      ${r.url}

Load tools first with a single ToolSearch call (one line):
  ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_close"

Goal: find an image on the source page that visually represents THIS event
"${r.title}" — its poster/flyer, a photo of the event, or (acceptably) the
venue's atmosphere image. You return the image's direct URL; a later step
downloads + rehosts it. Do NOT take screenshots — we only need the URL.

Steps:
1. browser_navigate to the url. Then gather candidates in one browser_evaluate:
   () => ({
     ogImage: (document.querySelector('meta[property="og:image"]')||{}).content || null,
     bodyLen: document.body.innerText.length,
     imgs: Array.from(document.querySelectorAll('img'))
       .map(i => ({ src: i.currentSrc || i.src, alt: i.alt || '',
                    w: i.naturalWidth || 0, h: i.naturalHeight || 0 }))
       .filter(i => i.src && i.w >= 200 && i.h >= 200),
     iframes: Array.from(document.querySelectorAll('iframe')).map(f => f.src),
   })
2. If nothing event-related is visible and there are iframes, follow them (incl.
   nested ones — Wix/Squarespace wrap content like a Google Calendar TWO iframes
   deep via filesusr.com / *.wixsite.com): browser_navigate to the iframe src,
   re-run the evaluate, and drill one level deeper if that page itself has
   iframes, looking for a poster/flyer image inside.
3. PICK the single best image, strongest first:
     a. An <img> whose alt or filename clearly matches "${r.title}" (or its
        poster/flyer) — e.g. alt="Tatort", "tatort-flyer.jpg", a monthly-programme
        PNG that features this event.
     b. The page's og:image, IF the page url is specific to this event/venue and
        the image depicts the event or venue atmosphere (not a generic logo/icon).
     c. The largest content <img> that plausibly depicts the event or venue.
   Prefer larger images. Resolve the URL to an absolute https URL.
4. KEEP-BIAS (important — a wrong cover is user-visible and worse than none):
   if you cannot find an image that plausibly represents this event or its venue
   — only logos, icons, sponsor badges, UI chrome, avatars, or an empty/login-
   walled page (e.g. instagram.com/p/...) — return image_source_url = null.
   Never invent a URL; never return a site logo or favicon as the cover.
5. browser_close.

Return the object: id/title/venue/url carried through verbatim, plus
\`image_source_url\` (absolute https URL or null) and a 1-line \`evidence\`
noting what you picked and why (e.g. "og:image poster matching title" or
"only the venue logo found → null").`
}

// --- Phase 1: Scrape — STRICTLY SEQUENTIAL ----------------------------------
// Do NOT convert to pipeline()/parallel(): shared browser tab (see header).
phase('Scrape')
log(`Scraping covers for ${roots.length} recurring series sequentially (shared browser tab — no parallelism)…`)

const candidates = []
for (let i = 0; i < roots.length; i++) {
  const r = roots[i]
  log(`[${i + 1}/${roots.length}] ${r.title} @ ${r.venue}`)
  const cand = await agent(subAgentPrompt(r), {
    label: `cover:${r.title}`,
    phase: 'Scrape',
    schema: CANDIDATE_SCHEMA,
  })
  if (cand) candidates.push(cand)
}

const withImage = candidates.filter((c) => c.image_source_url)
log(`Collected ${candidates.length}/${roots.length} candidates — ${withImage.length} with an image, `
  + `${candidates.length - withImage.length} none-found`)

// --- Phase 2: Apply ---------------------------------------------------------
phase('Apply')

// The runtime has no filesystem access, so an agent writes the candidates JSON
// (python3 + json.dumps — never the Write tool; German typographic quotes in
// evidence would break hand-written JSON) and runs the apply script.
const applyOut = await agent(
  `Working directory: ${WORKDIR}

Write this JSON array to ${CANDIDATES_FILE} using python3 (NOT the Write tool —
German quotes would break hand-written JSON), then apply the covers.

Run exactly this (heredoc):
python3 << 'PYEOF'
import json
# Parse as a JSON string (NOT a bare Python literal): JSON null/true/false are
# not valid Python, and image_source_url is null for none-found series.
candidates = json.loads(r'''${JSON.stringify(candidates)}''')
with open('${CANDIDATES_FILE}', 'w', encoding='utf-8') as f:
    json.dump(candidates, f, ensure_ascii=False, indent=2)
print('wrote', len(candidates), 'candidates')
PYEOF

Then run:
  python3 scripts/apply_recurring_images.py ${CANDIDATES_FILE}

Return the stdout of both commands verbatim (the apply script prints a summary
line and, on stderr, one line per series).`,
  { label: 'apply-covers', phase: 'Apply' }
)

log('Covers applied (see summary).')

return {
  summary: {
    total: candidates.length,
    with_image: withImage.length,
    none_found: candidates.length - withImage.length,
  },
  none_found: candidates
    .filter((c) => !c.image_source_url)
    .map((c) => ({ title: c.title, venue: c.venue, evidence: c.evidence })),
  applied: withImage.map((c) => ({
    title: c.title, venue: c.venue, image_source_url: c.image_source_url, evidence: c.evidence,
  })),
  apply_output: applyOut,
}
