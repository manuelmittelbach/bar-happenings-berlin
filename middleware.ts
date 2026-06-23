// Vercel Edge Middleware — per-event link-preview tags.
//
// WHY THIS EXISTS
// The app is a client-only SPA: every route is served the same static
// index.html, whose og:/twitter: meta tags are generic ("Inside Bars").
// Link crawlers (WhatsApp, Telegram, iMessage, Signal, Slack…) do NOT run
// JavaScript, so they only ever see that generic HTML — every shared event
// link gets the same preview card.
//
// This middleware runs ONLY for /event/:id (see `config.matcher`). It fetches
// the event from Supabase, takes the built index.html, and swaps the title +
// og:/twitter: tags for event-specific values. Humans get the exact same HTML
// shell (React boots normally); crawlers read the per-event tags. Every other
// route is untouched and falls through to the normal SPA rewrite.
//
// Scope (for now): a TEXT-ONLY card — title led by a compact date/time
// ("Di 23.6., 20:00 · <event>") so it survives truncation, plus a
// "venue — description" line, no preview image. (Adding an event/venue image or a
// generated branded card is a deliberate later step — see
// ~/.claude/plans/per-event-share-previews.md.)

// Public anon credentials — identical to what already ships in the client JS
// bundle (protected by RLS, safe to embed). Inlined rather than read from
// process.env so the preview works on every deployment with zero env setup.
const SUPABASE_URL = "https://uybvrxqleutguucrifuf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YnZyeHFsZXV0Z3V1Y3JpZnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDQ2MTgsImV4cCI6MjA5MDk4MDYxOH0.5QihSnNe9cwnbPdQf2Vtq4T0-GuSQbZQ1FEKRk18raU";

// Canonical public origin for og:url. MUST be the www host: the apex
// (insidebars.co) 307-redirects to www, and this middleware only runs on the
// final host — pointing at www avoids the redirect hop for crawlers.
const SITE = "https://www.insidebars.co";

// Run only on event detail pages. All other paths skip the middleware entirely
// and keep using the SPA rewrite in vercel.json.
export const config = { matcher: "/event/:id" };

interface EventRow {
  title: string | null;
  description: string | null;
  date: string | null;
  start_time: string | null;
  venue: string | null;
}

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Escape for use inside an HTML double-quoted attribute. Without this a stray
// `"` or `<` in a user-entered title would break out of the meta tag.
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Deterministic German date label, no Intl/ICU dependency (edge ICU coverage
// is not guaranteed). "Do, 25. Juni" — with time: "Do, 25. Juni, 20:00 Uhr".
function formatDate(dateStr: string | null, timeStr: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return dateStr || "";
  const y = +m[1], mo = +m[2], da = +m[3];
  const d = new Date(Date.UTC(y, mo - 1, da, 12));
  let label = `${WEEKDAYS[d.getUTCDay()]}, ${da}. ${MONTHS[mo - 1]}`;
  if (timeStr) label += `, ${timeStr.slice(0, 5)} Uhr`;
  return label;
}

// Compact variant for the title prefix: "Di 23.6., 20:00" (numeric month, no
// "Uhr") — short enough to survive ahead of a long event name when the title
// is truncated.
function formatDateCompact(dateStr: string | null, timeStr: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return "";
  const y = +m[1], mo = +m[2], da = +m[3];
  const wd = WEEKDAYS[new Date(Date.UTC(y, mo - 1, da, 12)).getUTCDay()];
  let label = `${wd} ${da}.${mo}.`;
  if (timeStr) label += `, ${timeStr.slice(0, 5)}`;
  return label;
}

// Look the event up exactly like the app's fetchEventById: try the live
// `events` table and the `events_archive` in parallel, prefer the live row.
// RLS governs visibility, so a non-public id simply yields null → generic card.
async function loadEvent(id: string): Promise<EventRow | null> {
  const headers = { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const select = "select=title,description,date,start_time,venue&limit=1";
  const query = (table: string): Promise<EventRow | null> =>
    fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&${select}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => (Array.isArray(rows) && rows[0] ? (rows[0] as EventRow) : null))
      .catch(() => null);
  const [live, archived] = await Promise.all([query("events"), query("events_archive")]);
  return live || archived;
}

// Replace the content="" of a single meta tag, identified by its leading
// attribute (e.g. `property="og:title"`). Function-form replacement so a `$`
// in the value is never interpreted as a capture-group reference.
function setMeta(html: string, selector: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*(")`, "i");
  return html.replace(re, (_m, pre, post) => `${pre}${value}${post}`);
}

function injectMeta(html: string, id: string, event: EventRow): string {
  const title = event.title?.trim() || "Inside Bars";
  const url = `${SITE}/event/${encodeURIComponent(id)}`;
  const eTitle = esc(title);

  // Card headline leads with a compact date/time, so when a long title is
  // truncated the day + time survive — clients show the title but often drop or
  // trim the description, where the date used to live. e.g.
  // "Di 23.6., 20:00 · <event name>".
  const compact = formatDateCompact(event.date, event.start_time);
  const cardTitle = compact ? `${esc(compact)} · ${eTitle}` : eTitle;

  // Description = venue + a snippet of the event's own text. The date is NOT
  // repeated here — it now lives in the title.
  let description = event.venue?.trim() || "";
  const snippet = event.description?.replace(/\s+/g, " ").trim();
  if (snippet) {
    const trimmed = snippet.length > 110 ? snippet.slice(0, 109) + "…" : snippet;
    description = description ? `${description} — ${trimmed}` : trimmed;
  }
  const eDesc = esc(description);

  // No preview image for events (for now) — a text-only card. Strip every
  // og:image* / twitter:image tag and downgrade the Twitter card to "summary"
  // (a "summary_large_image" card with no image renders as a broken box).
  html = html.replace(/\s*<meta\s+property="og:image[^"]*"[^>]*>/gi, "");
  html = html.replace(/\s*<meta\s+name="twitter:image"[^>]*>/gi, "");
  html = setMeta(html, 'name="twitter:card"', "summary");

  // Card title = date-led cardTitle (no "· Inside Bars" — clients show the iB
  // favicon + og:site_name already). The <title> keeps the brand suffix for
  // the browser tab / SEO.
  html = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${eTitle} · Inside Bars</title>`);
  html = setMeta(html, 'name="description"', eDesc);
  html = setMeta(html, 'property="og:url"', esc(url));
  html = setMeta(html, 'property="og:title"', cardTitle);
  html = setMeta(html, 'property="og:description"', eDesc);
  html = setMeta(html, 'name="twitter:title"', cardTitle);
  html = setMeta(html, 'name="twitter:description"', eDesc);
  return html;
}

function htmlResponse(html: string, prerendered: boolean): Response {
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (prerendered) {
    // Edge-cache the rendered shell briefly; serve stale while revalidating so
    // a freshly edited event reflects within minutes without hammering the DB.
    headers["cache-control"] = "public, s-maxage=300, stale-while-revalidate=86400";
    headers["x-ib-prerender"] = "event";
  }
  return new Response(html, { status: 200, headers });
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.split("/")[2] || "");

  // Fetch the built SPA shell. (`/index.html` isn't matched by config.matcher,
  // so this never loops back through the middleware.)
  let shell: string;
  try {
    shell = await fetch(new URL("/index.html", url)).then((r) => r.text());
  } catch {
    // Can't even get the shell — let the platform serve it normally.
    return fetch(new URL("/index.html", url));
  }

  if (!id) return htmlResponse(shell, false);

  try {
    const event = await loadEvent(id);
    if (!event) return htmlResponse(shell, false);
    return htmlResponse(injectMeta(shell, id, event), true);
  } catch {
    // Any failure → serve the generic shell. A shared link must never 500.
    return htmlResponse(shell, false);
  }
}
