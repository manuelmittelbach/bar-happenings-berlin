const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "BarHappeningsBerlin/1.0 (manumittelbach@live.de)";
const BERLIN_VIEWBOX = "13.0,52.75,13.8,52.3";
const MIN_IMPORTANCE = 0.3;
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
  importance?: number;
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
  url.searchParams.set("addressdetails", "0");
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
  const importance = typeof top.importance === "number" ? top.importance : 0;
  if (importance < MIN_IMPORTANCE) {
    return new Response(JSON.stringify({ error: "low_confidence" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lat = Number(top.lat);
  const lng = Number(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ lat, lng, displayName: top.display_name, importance }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
