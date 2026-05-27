const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "BarHappeningsBerlin/1.0 (manumittelbach@live.de)";
// Nominatim viewbox: left lon, top lat, right lon, bottom lat.
const BERLIN_VIEWBOX = "13.0,52.75,13.8,52.3";
const BERLIN_BOUNDS = { latMin: 52.3, latMax: 52.75, lngMin: 13.0, lngMax: 13.8 };
// Gate on `place_rank` (how SPECIFIC the match is), NOT `importance`. Nominatim's
// `importance` scores notability (Wikipedia links etc.), so a precise house
// number scores ~0 and a strict importance gate wrongly rejects real addresses.
// place_rank ≈ 30 = house/building/POI, ≈ 26-27 = street, < 26 = suburb/city/
// postcode only. Requiring ≥ 26 keeps the pin on the address rather than a
// neighbourhood centroid, while accepting exact house numbers.
const MIN_PLACE_RANK = 26;
const THROTTLE_MS = 1100;

let lastCallAt = 0;

async function throttle() {
  const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastCallAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  place_rank?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawAddress = typeof body.address === "string" ? body.address.trim() : "";
  if (rawAddress.length < 5) {
    return new Response(JSON.stringify({ error: "invalid" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const query = /berlin/i.test(rawAddress) ? rawAddress : `${rawAddress}, Berlin, Germany`;
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("viewbox", BERLIN_VIEWBOX);
  url.searchParams.set("bounded", "1");
  // addressdetails=1 ensures `place_rank` is present in the result (used below).
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", query);

  await throttle();

  let results: NominatimResult[];
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "upstream_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    results = await res.json();
  } catch {
    return new Response(JSON.stringify({ error: "upstream_error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(results) || results.length === 0) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const top = results[0];
  const lat = Number(top.lat);
  const lng = Number(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Defense-in-depth: bounded=1 should already restrict to Berlin, but don't
  // trust upstream blindly — reject anything that landed outside the box.
  const inBerlin =
    lat >= BERLIN_BOUNDS.latMin && lat <= BERLIN_BOUNDS.latMax &&
    lng >= BERLIN_BOUNDS.lngMin && lng <= BERLIN_BOUNDS.lngMax;
  // Require a street-level-or-better match. If place_rank is somehow absent,
  // fall back to the in-Berlin check alone rather than wrongly rejecting.
  const placeRank = typeof top.place_rank === "number" ? top.place_rank : MIN_PLACE_RANK;
  if (!inBerlin || placeRank < MIN_PLACE_RANK) {
    return new Response(JSON.stringify({ error: "low_confidence" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ lat, lng, displayName: top.display_name, placeRank }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
