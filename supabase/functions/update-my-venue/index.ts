import { createClient } from "jsr:@supabase/supabase-js@2";

// Organizer self-service: an approved organizer updates their own venue.
// Hard whitelist of editable columns — name/address/geo stay admin-only.
// Returns the updated venue row.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Patch = {
  image?: string | null;
  image_position?: string | null;
  website?: string | null;
  instagram?: string | null;
  phone?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function normUrl(v: unknown): string | null | undefined {
  const n = normString(v);
  if (n === undefined || n === null) return n;
  // Accept bare domains by prepending https://
  const withProto = /^https?:\/\//i.test(n) ? n : `https://${n}`;
  try {
    const u = new URL(withProto);
    return u.toString();
  } catch {
    return "__INVALID__";
  }
}

function normPosition(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return undefined;
  // Expected format: "<x>% <y>%" with x,y in [0,100]
  const match = v.trim().match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return undefined;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if (x < 0 || x > 100 || y < 0 || y > 100) return undefined;
  return `${x}% ${y}%`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  // Auth-scoped client (verifies the caller via the Authorization header)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Service-role client (writes bypass RLS — we enforce the whitelist
  // and the ownership check in this function instead of via RLS).
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Approval gate: only approved organizers can self-edit.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return jsonResponse({ error: "Failed to load profile" }, 500);
  }
  if (!profile || profile.role !== "organizer" || profile.approval_status !== "approved") {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  // Ownership: the caller must own the venue via venue_owners.
  const { data: owner, error: ownerError } = await adminClient
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownerError) {
    return jsonResponse({ error: "Failed to resolve venue" }, 500);
  }
  if (!owner?.venue_id) {
    return jsonResponse({ error: "No venue linked to this account" }, 404);
  }
  const venueId = owner.venue_id as string;

  let payload: Patch;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Whitelist + normalize. Anything outside the whitelist is silently dropped.
  const patch: Record<string, string | null> = {};

  if (Object.prototype.hasOwnProperty.call(payload, "image")) {
    const v = payload.image;
    if (v === null) {
      patch.image = null;
    } else if (typeof v === "string" && v.trim().length > 0) {
      patch.image = v.trim();
    } else if (v !== undefined) {
      return jsonResponse({ error: "Invalid image value" }, 400);
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "image_position")) {
    const v = normPosition(payload.image_position);
    if (v === undefined) {
      return jsonResponse({ error: "Invalid image_position" }, 400);
    }
    patch.image_position = v;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "website")) {
    const v = normUrl(payload.website);
    if (v === "__INVALID__") {
      return jsonResponse({ error: "Invalid website URL" }, 400);
    }
    if (v !== undefined) patch.website = v;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "instagram")) {
    const v = normString(payload.instagram);
    if (v !== undefined) patch.instagram = v;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    const v = normString(payload.phone);
    if (v !== undefined) patch.phone = v;
  }

  if (Object.keys(patch).length === 0) {
    return jsonResponse({ error: "Nothing to update" }, 400);
  }

  const { data: updated, error: updateError } = await adminClient
    .from("venues")
    .update(patch)
    .eq("id", venueId)
    .select("id, image, image_position, website, instagram, phone")
    .single();
  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({ ok: true, venue: updated });
});
