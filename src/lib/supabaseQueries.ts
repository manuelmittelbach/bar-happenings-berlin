import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { BarlinEvent, StagedEvent, StagedEventEdits, StagedEventScope, Venue } from "@/types/event";
import { formatRule, generateOccurrences, type RecurrenceFreq } from "@/lib/recurrence";
import { berlinDateStringOffset } from "@/lib/dateFormat";
import { geocodeAddress } from "@/lib/geocoding";

// Postgres `time` columns return "HH:MM:SS"; legacy text rows in `events` may
// also contain seconds. Normalize everything to HH:MM at every read/write
// boundary so seconds never reach the UI.
function trimTime(t: string | null | undefined): string {
  if (!t) return "";
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : t;
}

// Doors-without-start is not a meaningful combination — when only a doors
// time is provided, treat it as the start time and clear doors. Mirrors the
// 2026-05-08 backfill so every read/render site can rely on start_time alone.
function normalizeStartDoors(
  startTime: string | null | undefined,
  doorsTime: string | null | undefined,
): { start: string | null; doors: string | null } {
  const s = startTime ? trimTime(startTime) : null;
  const d = doorsTime ? trimTime(doorsTime) : null;
  if (!s && d) return { start: d, doors: null };
  return { start: s, doors: d };
}

// Strip third-party click/tracking params before persisting URLs — otherwise
// every visitor that clicks an event link forwards Facebook/Google/etc. tracking
// without consent. Non-URL strings pass through unchanged so we don't destroy
// what the user typed.
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "yclid", "dclid", "msclkid",
  "mc_cid", "mc_eid", "_hsenc", "_hsmi",
  "igshid", "twclid", "ttclid", "li_fat_id",
]);
function cleanUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    [...u.searchParams.keys()].forEach(k => {
      if (TRACKING_PARAMS.has(k) || k.startsWith("utm_")) {
        u.searchParams.delete(k);
      }
    });
    return u.toString();
  } catch {
    return raw;
  }
}

function mapEventRow(row: Tables<"events"> | Tables<"events_archive">): BarlinEvent {
  // events_archive never has editorial fields — they only live on the
  // active events table. Same pattern we already use for is_manual.
  const liveRow = row as Tables<"events">;
  const isLive = "is_highlight" in row;
  return {
    id: row.id,
    parentId: row.parent_id ?? "",
    title: row.title,
    venue: row.venue,
    venueId: row.venue_id ?? "",
    neighborhood: row.neighborhood,
    address: row.address,
    date: row.date,
    startTime: trimTime(row.start_time),
    endTime: row.end_time ? trimTime(row.end_time) : undefined,
    doorsTime: row.doors_time ? trimTime(row.doors_time) : undefined,
    category: row.category,
    description: row.description ?? "",
    entryInfo: row.entry_info ?? "",
    language: row.language ?? "",
    recurrence: row.recurrence ?? "",
    url: row.url ?? "",
    image: row.image ?? undefined,
    imagePosition: row.image_position ?? "50% 50%",
    interestedCount: row.interested_count ?? 0,
    status: row.status,
    createdBy: row.created_by ?? undefined,
    isManual: "is_manual" in row ? liveRow.is_manual : false,
    canceledBy: (row.canceled_by ?? null) as "organizer" | "admin" | null,
    isHighlight: isLive ? liveRow.is_highlight : false,
    editorNote: isLive ? liveRow.editor_note ?? undefined : undefined,
    highlightPriority: isLive ? liveRow.highlight_priority : 0,
    createdAt: row.created_at ?? undefined,
    // Only the live `events` table has submitted_by_user; archive rows lack
    // it and surface as false (no badge on past events anyway).
    isCommunitySubmission: isLive ? liveRow.submitted_by_user : false,
  };
}

function mapVenueRow(row: Tables<"venues">): Venue {
  return {
    id: row.id,
    name: row.name,
    neighborhood: row.neighborhood,
    address: row.address,
    description: row.description ?? "",
    image: row.image ?? "",
    imagePosition: row.image_position,
    imageOg: row.image_og ?? undefined,
    imageGoogle: row.image_google ?? undefined,
    instagram: row.instagram ?? undefined,
    telegram: row.telegram ?? undefined,
    website: row.website ?? undefined,
    websiteEvents: row.website_events ?? undefined,
    phone: row.phone ?? undefined,
    scrapeEnabled: row.scrape_enabled,
    instagramScrapeEnabled: row.instagram_scrape_enabled,
    telegramScrapeEnabled: row.telegram_scrape_enabled,
    isVisible: row.is_visible,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}

// Admin-only — RLS gates this to `is_admin()`. Promotes one of the
// archived image sources (`image_og` / `image_google`) into the live
// `image` column so visitors see it on /bars and /bar/:id renderers.
export async function setVenueActiveImage(venueId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ image: url })
    .eq("id", venueId);
  if (error) throw error;
}

export async function setVenueScrapeEnabled(
  venueId: string,
  scrapeEnabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ scrape_enabled: scrapeEnabled })
    .eq("id", venueId);
  if (error) throw error;
}

export async function setVenueInstagramScrapeEnabled(
  venueId: string,
  instagramScrapeEnabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ instagram_scrape_enabled: instagramScrapeEnabled })
    .eq("id", venueId);
  if (error) throw error;
}

export async function setVenueTelegramScrapeEnabled(
  venueId: string,
  telegramScrapeEnabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ telegram_scrape_enabled: telegramScrapeEnabled })
    .eq("id", venueId);
  if (error) throw error;
}

export async function setVenueVisible(venueId: string, visible: boolean): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ is_visible: visible })
    .eq("id", venueId);
  if (error) throw error;
}

export async function updateVenueLinks(
  venueId: string,
  patch: { website?: string | null; instagram?: string | null; websiteEvents?: string | null; telegram?: string | null },
): Promise<void> {
  const update: TablesUpdate<"venues"> = {};
  if (patch.website !== undefined) update.website = patch.website;
  if (patch.instagram !== undefined) update.instagram = patch.instagram;
  if (patch.websiteEvents !== undefined) update.website_events = patch.websiteEvents;
  if (patch.telegram !== undefined) update.telegram = patch.telegram;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("venues")
    .update(update)
    .eq("id", venueId);
  if (error) throw error;
}

export async function fetchEvents(untilDate?: string): Promise<BarlinEvent[]> {
  const { data: venueData, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("is_visible", true);
  if (venueError) throw venueError;
  const visibleIds = (venueData ?? []).map((v) => v.id);
  if (visibleIds.length === 0) return [];

  let query = supabase
    .from("events")
    .select("*")
    .in("status", ["approved", "canceled"])
    .in("venue_id", visibleIds);
  if (untilDate) query = query.lte("date", untilDate);
  const { data, error } = await query.order("date").order("start_time");
  if (error) throw error;
  return data.map(mapEventRow);
}

export async function fetchEventsByCreator(userId: string): Promise<BarlinEvent[]> {
  const [live, arch] = await Promise.all([
    supabase.from("events").select("*").eq("created_by", userId),
    supabase.from("events_archive").select("*").eq("created_by", userId),
  ]);
  if (live.error) throw live.error;
  if (arch.error) throw arch.error;
  const rows = [...(live.data ?? []), ...(arch.data ?? [])];
  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return rows.map(mapEventRow);
}

export async function fetchEventById(id: string): Promise<BarlinEvent | null> {
  const [live, arch] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("events_archive").select("*").eq("id", id).maybeSingle(),
  ]);
  if (live.data) return mapEventRow(live.data);
  if (arch.data) return mapEventRow(arch.data);
  // Surface network/abort errors so the page can show a retry UI instead
  // of a "not found" page when the lookup actually failed.
  if (live.error) throw live.error;
  if (arch.error) throw arch.error;
  return null;
}

export async function uploadEventImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("event-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("event-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadVenueImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("venue-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("venue-images").getPublicUrl(path);
  return data.publicUrl;
}

export interface MyVenuePatch {
  image?: string | null;
  image_position?: string;
  website?: string | null;
  instagram?: string | null;
  phone?: string | null;
}

export interface MyVenueUpdateResult {
  id: string;
  image: string | null;
  image_position: string;
  website: string | null;
  instagram: string | null;
  phone: string | null;
}

export async function updateMyVenue(patch: MyVenuePatch): Promise<MyVenueUpdateResult> {
  const { data, error } = await supabase.functions.invoke("update-my-venue", {
    body: patch,
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error?: string }).error ?? "Update failed"));
  }
  return (data as { venue: MyVenueUpdateResult }).venue;
}

/** Permanently delete the signed-in user's own account. The edge function
 * verifies the caller from their JWT and deletes the auth user; DB cascades
 * remove their profile, events, interests, ownership link and pending rows.
 * The venue (bar) is kept (unowned). */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account");
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error?: string }).error ?? "Delete failed"));
  }
}

interface EventWriteData {
  title: string; venue: string; venueId?: string; address: string; neighborhood: string;
  date: string; startTime: string; endTime: string; doorsTime: string; category: string;
  description: string; entryInfo: string; language: string; website: string;
  imagePosition: string;
  recurrence: string; recurrenceUntil: string;
  // Moderation status of the created row. Approved bar owners + admins publish
  // straight to "approved" (live); plain users come in as "pending" for admin
  // review. RLS enforces this server-side regardless of what the caller sends.
  status?: "approved" | "pending";
}

function buildEventRow(
  formData: EventWriteData,
  userId: string,
  imageUrl: string | undefined,
  overrides: { id: string; date: string; parent_id: string; recurrence: string },
): TablesInsert<"events"> {
  const times = normalizeStartDoors(formData.startTime, formData.doorsTime);
  return {
    id: overrides.id,
    parent_id: overrides.parent_id,
    recurrence: overrides.recurrence,
    title: formData.title,
    venue: formData.venue,
    venue_id: formData.venueId || null,
    address: formData.address,
    neighborhood: formData.neighborhood,
    date: overrides.date,
    start_time: times.start,
    end_time: formData.endTime ? trimTime(formData.endTime) : null,
    doors_time: times.doors,
    category: formData.category,
    description: formData.description || null,
    entry_info: formData.entryInfo || null,
    language: formData.language || null,
    url: cleanUrl(formData.website) || null,
    image: imageUrl || null,
    image_position: formData.imagePosition,
    created_by: userId,
    status: formData.status ?? "approved",
    is_manual: true,
  };
}

export async function createEvent(
  formData: EventWriteData,
  userId: string,
  imageUrl?: string,
): Promise<void> {
  if (!formData.recurrence) {
    const row = buildEventRow(formData, userId, imageUrl, {
      id: crypto.randomUUID(),
      date: formData.date,
      parent_id: "",
      recurrence: "",
    });
    const { error } = await supabase.from("events").insert(row);
    if (error) throw error;
    return;
  }

  const freq = formData.recurrence as RecurrenceFreq;
  const dates = generateOccurrences(formData.date, freq, formData.recurrenceUntil);
  if (dates.length === 0) throw new Error("No occurrences generated for recurring event.");

  const parentId = crypto.randomUUID();
  const parentRule = formatRule(freq, formData.recurrenceUntil);
  const rows: TablesInsert<"events">[] = dates.map((date, idx) =>
    buildEventRow(formData, userId, imageUrl, {
      id: idx === 0 ? parentId : crypto.randomUUID(),
      date,
      parent_id: idx === 0 ? "" : parentId,
      recurrence: idx === 0 ? parentRule : "",
    }),
  );
  const { error } = await supabase.from("events").insert(rows);
  if (error) throw error;
}

// Date and time are gated separately: a single-event edit updates both, while a
// series edit unifies the time across all upcoming occurrences (so a series can
// be shifted, e.g. 20:00 → 21:00) but never the date, which stays per-occurrence.
function buildUpdatePatch(
  formData: EventWriteData,
  imageUrl: string | null | undefined,
  opts: { includeDate: boolean; includeTime: boolean },
): TablesUpdate<"events"> {
  const update: TablesUpdate<"events"> = {
    title: formData.title,
    venue: formData.venue,
    ...(formData.venueId ? { venue_id: formData.venueId } : {}),
    address: formData.address,
    neighborhood: formData.neighborhood,
    category: formData.category,
    description: formData.description || null,
    entry_info: formData.entryInfo || null,
    language: formData.language || null,
    url: cleanUrl(formData.website) || null,
    image_position: formData.imagePosition,
  };
  if (opts.includeTime) {
    const times = normalizeStartDoors(formData.startTime, formData.doorsTime);
    update.start_time = times.start;
    update.end_time = formData.endTime ? trimTime(formData.endTime) : null;
    update.doors_time = times.doors;
  }
  if (opts.includeDate) {
    update.date = formData.date;
  }
  if (imageUrl !== undefined) update.image = imageUrl;
  return update;
}

export async function updateEvent(
  id: string,
  formData: EventWriteData,
  imageUrl?: string | null,
): Promise<void> {
  const update = buildUpdatePatch(formData, imageUrl, { includeDate: true, includeTime: true });
  const { error } = await supabase.from("events").update(update).eq("id", id);
  if (error) throw error;
}

// Series-wide field edit ("this and all upcoming events"). Shared fields and the
// time are rewritten (so a series can be shifted, e.g. 20:00 → 21:00); the date
// stays per-occurrence (includeDate:false). We scope to the series, then to
// occurrences on/after fromDate — but ALWAYS include the parent (the earliest
// row, id === seriesId) even though its date is in the past: the parent is the
// template the auto-extend cron copies forward, so leaving it stale would make
// future occurrences revert to the old image/fields/time. Past child
// occurrences are still left untouched.
export async function updateEventSeries(
  seriesId: string,
  fromDate: string,
  formData: EventWriteData,
  imageUrl?: string | null,
): Promise<void> {
  const update = buildUpdatePatch(formData, imageUrl, { includeDate: false, includeTime: true });
  const { error } = await supabase
    .from("events")
    .update(update)
    .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    .or(`date.gte.${fromDate},id.eq.${seriesId}`);
  if (error) throw error;
}

// Owner-triggered "Extend series": materializes more occurrences up to 6 months
// from today via the extend_my_series RPC (SECURITY DEFINER + ownership check),
// so plain-user series go live immediately just like the auto-extend cron does
// for indefinite ones. Returns how many new occurrences were created.
export async function extendEventSeries(seriesId: string): Promise<number> {
  const { data, error } = await supabase.rpc("extend_my_series", { p_series_id: seriesId });
  if (error) throw error;
  return data ?? 0;
}

// Venue details an admin turns into a brand-new bar (or links to an existing
// one) when approving a typed-venue submission. Consumed by the admin
// "Create bar & link" action and createVenueForStagedSubmission.
export interface SubmissionVenueData {
  name: string;
  address: string;
  neighborhood: string;
}

export async function cancelEvent(id: string, by: "organizer" | "admin"): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ status: "canceled", canceled_by: by })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelEventSeries(seriesId: string, fromDate: string, by: "organizer" | "admin"): Promise<void> {
  // Fetch IDs of later events in the series (date > fromDate) — these get deleted.
  const { data: laterRows, error: fetchErr } = await supabase
    .from("events")
    .select("id")
    .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    .gt("date", fromDate);
  if (fetchErr) throw fetchErr;

  const laterIds = (laterRows ?? []).map((r) => r.id);

  if (laterIds.length > 0) {
    // Clean up user_interests before deleting events (FK constraint).
    const { error: interestErr } = await supabase
      .from("user_interests")
      .delete()
      .in("event_id", laterIds);
    if (interestErr) throw interestErr;

    const { error: deleteErr } = await supabase
      .from("events")
      .delete()
      .in("id", laterIds);
    if (deleteErr) throw deleteErr;
  }

  // The event at fromDate stays visible, marked as canceled.
  const { error: updateErr } = await supabase
    .from("events")
    .update({ status: "canceled", canceled_by: by })
    .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    .eq("date", fromDate);
  if (updateErr) throw updateErr;
}

export async function fetchEventSeries(seriesId: string): Promise<BarlinEvent[]> {
  const filter = `id.eq.${seriesId},parent_id.eq.${seriesId}`;
  const [live, arch] = await Promise.all([
    supabase.from("events").select("*").or(filter),
    supabase.from("events_archive").select("*").or(filter),
  ]);
  if (live.error) throw live.error;
  if (arch.error) throw arch.error;
  const rows = [...(live.data ?? []), ...(arch.data ?? [])];
  rows.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return rows.map(mapEventRow);
}

export async function fetchEventsByVenue(
  venueId: string,
  fromDate: string,
): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("venue_id", venueId)
    .gte("date", fromDate)
    .in("status", ["approved", "canceled"])
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEventRow);
}

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from("venues").select("*").eq("is_visible", true);
  if (error) throw error;
  return data.map(mapVenueRow);
}

export interface CategoryRow {
  id: string;
  label: string;
  emoji: string;
  color: string;
  enabled: boolean;
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, label, emoji, color, enabled");
  if (error) throw error;
  return data;
}

export async function fetchVenuesWithOwnership(): Promise<{ venue: Venue; hasOwner: boolean }[]> {
  const [venuesRes, ownersRes] = await Promise.all([
    supabase.from("venues").select("*").order("name", { ascending: true }),
    supabase.from("venue_owners").select("venue_id"),
  ]);
  if (venuesRes.error) throw venuesRes.error;
  if (ownersRes.error) throw ownersRes.error;
  const ownedSet = new Set((ownersRes.data ?? []).map((o) => o.venue_id));
  return (venuesRes.data ?? []).map((row) => ({
    venue: mapVenueRow(row),
    hasOwner: ownedSet.has(row.id),
  }));
}

export async function fetchUserRole(userId: string): Promise<"user" | "organizer" | "admin"> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const r = data?.role;
  if (r === "admin" || r === "organizer") return r;
  return "user";
}

export async function fetchProfile(userId: string): Promise<{ firstName: string; lastName: string; role: string; approvalStatus: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, role, approval_status")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { firstName: data.first_name, lastName: data.last_name, role: data.role, approvalStatus: data.approval_status };
}

export async function updateProfile(userId: string, profile: { firstName: string; lastName: string }): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: profile.firstName, last_name: profile.lastName })
    .eq("id", userId);
  if (error) throw error;
}

export type OrganizerAccount = {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  venue: {
    id: string;
    name: string;
    address: string;
    neighborhood: string;
    website: string | null;
    instagram: string | null;
    phone: string | null;
    image: string | null;
    image_position: string;
    lat: number;
    lng: number;
  } | null;
  pendingSubmission: {
    name: string;
    address: string;
    neighborhood: string;
    website: string | null;
    instagram: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  pendingClaim: {
    venueId: string;
    venueName: string;
    venueAddress: string;
    venueNeighborhood: string;
    venueWebsite: string | null;
    venueInstagram: string | null;
    venuePhone: string | null;
    proposedWebsite: string | null;
    proposedInstagram: string | null;
    proposedPhone: string | null;
    // Conflict info — populated by hydrateOrganizers so the admin sees
    // when a pending claim targets a venue that's already owned or also
    // requested by someone else. Empty arrays = no conflict.
    existingOwners: { userId: string; name: string; email: string | null }[];
    otherPendingClaims: { userId: string; name: string; email: string | null }[];
  } | null;
  // True if organizer is in pending state but has no submission AND no claim
  // (e.g. claim's venue was deleted and CASCADE removed the claim row).
  orphaned: boolean;
};

type OrganizerProfileRow = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
};

async function hydrateOrganizers(profiles: OrganizerProfileRow[]): Promise<OrganizerAccount[]> {
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.id);
  const [ownersRes, submissionsRes, claimsRes] = await Promise.all([
    supabase
      .from("venue_owners")
      .select("user_id, venues ( id, name, address, neighborhood, website, instagram, phone, image, image_position, lat, lng )")
      .in("user_id", ids),
    supabase
      .from("pending_bar_submissions")
      .select("user_id, name, address, neighborhood, website, instagram, phone, lat, lng")
      .in("user_id", ids),
    supabase
      .from("pending_venue_claims")
      .select("user_id, venue_id, proposed_website, proposed_instagram, proposed_phone, venues ( id, name, address, neighborhood, website, instagram, phone )")
      .in("user_id", ids),
  ]);
  if (ownersRes.error) throw ownersRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (claimsRes.error) throw claimsRes.error;
  const venueByUser = new Map<string, OrganizerAccount["venue"]>();
  for (const row of ownersRes.data ?? []) {
    const v = (row as { user_id: string; venues: OrganizerAccount["venue"] | null }).venues;
    if (v) venueByUser.set((row as { user_id: string }).user_id, v);
  }
  const submissionByUser = new Map<string, OrganizerAccount["pendingSubmission"]>();
  for (const row of submissionsRes.data ?? []) {
    const r = row as {
      user_id: string;
      name: string;
      address: string;
      neighborhood: string;
      website: string | null;
      instagram: string | null;
      phone: string | null;
      lat: number | null;
      lng: number | null;
    };
    submissionByUser.set(r.user_id, {
      name: r.name,
      address: r.address,
      neighborhood: r.neighborhood,
      website: r.website,
      instagram: r.instagram,
      phone: r.phone,
      lat: r.lat,
      lng: r.lng,
    });
  }
  type ClaimSource = {
    user_id: string;
    venue_id: string;
    proposed_website: string | null;
    proposed_instagram: string | null;
    proposed_phone: string | null;
    venues: {
      id: string;
      name: string;
      address: string;
      neighborhood: string;
      website: string | null;
      instagram: string | null;
      phone: string | null;
    } | null;
  };
  const claimRows = (claimsRes.data ?? []) as ClaimSource[];

  // For every venue that any of the input organizers is claiming, also load
  // existing venue_owners + ALL pending claims for that venue. Lets the admin
  // see double-claim situations on the approve card. Skip the extra round-trips
  // entirely when there are no claims in this batch.
  // venue_owners.user_id and pending_venue_claims.user_id reference auth.users,
  // not profiles, so PostgREST won't auto-join — fetch profiles separately.
  const claimVenueIds = Array.from(
    new Set(claimRows.map((r) => r.venue_id).filter((id): id is string => !!id)),
  );
  type ConflictParty = { userId: string; name: string; email: string | null };
  const ownersByVenue = new Map<string, ConflictParty[]>();
  const claimantsByVenue = new Map<string, ConflictParty[]>();
  if (claimVenueIds.length > 0) {
    const [conflictOwnersRes, conflictClaimsRes] = await Promise.all([
      supabase
        .from("venue_owners")
        .select("venue_id, user_id")
        .in("venue_id", claimVenueIds),
      supabase
        .from("pending_venue_claims")
        .select("venue_id, user_id")
        .in("venue_id", claimVenueIds),
    ]);
    if (conflictOwnersRes.error) throw conflictOwnersRes.error;
    if (conflictClaimsRes.error) throw conflictClaimsRes.error;
    const ownerRows = (conflictOwnersRes.data ?? []) as { venue_id: string; user_id: string }[];
    const claimRowsAll = (conflictClaimsRes.data ?? []) as { venue_id: string; user_id: string }[];
    const conflictUserIds = Array.from(
      new Set([...ownerRows.map((r) => r.user_id), ...claimRowsAll.map((r) => r.user_id)]),
    );
    const partyByUser = new Map<string, ConflictParty>();
    if (conflictUserIds.length > 0) {
      const profilesRes = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", conflictUserIds);
      if (profilesRes.error) throw profilesRes.error;
      for (const p of (profilesRes.data ?? []) as {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
      }[]) {
        partyByUser.set(p.id, {
          userId: p.id,
          name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "(no name)",
          email: p.email ?? null,
        });
      }
    }
    const fallbackParty = (userId: string): ConflictParty =>
      partyByUser.get(userId) ?? { userId, name: "(unknown user)", email: null };
    for (const row of ownerRows) {
      const arr = ownersByVenue.get(row.venue_id) ?? [];
      arr.push(fallbackParty(row.user_id));
      ownersByVenue.set(row.venue_id, arr);
    }
    for (const row of claimRowsAll) {
      const arr = claimantsByVenue.get(row.venue_id) ?? [];
      arr.push(fallbackParty(row.user_id));
      claimantsByVenue.set(row.venue_id, arr);
    }
  }

  const claimByUser = new Map<string, OrganizerAccount["pendingClaim"]>();
  for (const r of claimRows) {
    if (!r.venues) continue;
    const existingOwners = ownersByVenue.get(r.venue_id) ?? [];
    const otherPendingClaims = (claimantsByVenue.get(r.venue_id) ?? []).filter(
      (p) => p.userId !== r.user_id,
    );
    claimByUser.set(r.user_id, {
      venueId: r.venue_id,
      venueName: r.venues.name,
      venueAddress: r.venues.address,
      venueNeighborhood: r.venues.neighborhood,
      venueWebsite: r.venues.website,
      venueInstagram: r.venues.instagram,
      venuePhone: r.venues.phone,
      proposedWebsite: r.proposed_website,
      proposedInstagram: r.proposed_instagram,
      proposedPhone: r.proposed_phone,
      existingOwners,
      otherPendingClaims,
    });
  }
  return profiles.map((row) => {
    const venue = venueByUser.get(row.id) ?? null;
    const pendingSubmission = submissionByUser.get(row.id) ?? null;
    const pendingClaim = claimByUser.get(row.id) ?? null;
    const orphaned =
      row.approval_status === "pending" &&
      !venue &&
      !pendingSubmission &&
      !pendingClaim;
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      approvalStatus: row.approval_status as OrganizerAccount["approvalStatus"],
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      venue,
      pendingSubmission,
      pendingClaim,
      orphaned,
    };
  });
}

const ORGANIZER_PROFILE_SELECT =
  "id, email, first_name, last_name, approval_status, approved_by, approved_at, created_at";

export async function fetchPendingOrganizers(): Promise<OrganizerAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ORGANIZER_PROFILE_SELECT)
    .eq("role", "organizer")
    .eq("approval_status", "pending")
    .eq("email_confirmed", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return hydrateOrganizers(data as OrganizerProfileRow[]);
}

export async function fetchDecidedOrganizers(): Promise<OrganizerAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ORGANIZER_PROFILE_SELECT)
    .eq("role", "organizer")
    .in("approval_status", ["approved", "rejected"])
    .order("approved_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const hydrated = await hydrateOrganizers(data as OrganizerProfileRow[]);
  // Hide approved organizers whose venue was deleted (zombie state) — they'd
  // otherwise show as "(no venue) Approved". Rejected entries stay visible
  // for audit (they never had a venue).
  return hydrated.filter((o) => o.approvalStatus !== "approved" || o.venue !== null);
}

export async function fetchOrganizerById(userId: string): Promise<OrganizerAccount | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ORGANIZER_PROFILE_SELECT)
    .eq("id", userId)
    .eq("role", "organizer")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const hydrated = await hydrateOrganizers([data as OrganizerProfileRow]);
  return hydrated[0] ?? null;
}

export async function updateOrganizerAccount(
  userId: string,
  profile: { firstName: string; lastName: string },
  venue: {
    id: string;
    name: string;
    address: string;
    neighborhood: string;
    website: string | null;
    instagram: string | null;
    phone: string | null;
    // Coordinates are optional — claim flow keeps the existing venue's coords,
    // venue-edit flow passes them explicitly to allow admin corrections.
    lat?: number;
    lng?: number;
  },
): Promise<void> {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ first_name: profile.firstName, last_name: profile.lastName })
    .eq("id", userId);
  if (profileError) throw profileError;

  const venuePatch: TablesUpdate<"venues"> = {
    name: venue.name,
    address: venue.address,
    neighborhood: venue.neighborhood,
    website: venue.website,
    instagram: venue.instagram,
    phone: venue.phone,
  };
  if (venue.lat !== undefined) venuePatch.lat = venue.lat;
  if (venue.lng !== undefined) venuePatch.lng = venue.lng;

  const { error: venueError } = await supabase
    .from("venues")
    .update(venuePatch)
    .eq("id", venue.id);
  if (venueError) throw venueError;
}

export async function updateOrganizerApprovalStatus(
  userId: string,
  status: "approved" | "rejected",
  approverId?: string,
): Promise<void> {
  const patch: { approval_status: string; approved_by: string | null; approved_at: string | null } = {
    approval_status: status,
    approved_by: status === "approved" ? approverId ?? null : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
  // On reject: clean up any pending data so the organizer entry doesn't keep dangling rows.
  if (status === "rejected") {
    await supabase.from("pending_bar_submissions").delete().eq("user_id", userId);
    await supabase.from("pending_venue_claims").delete().eq("user_id", userId);
  }
}

export async function clearVenueClaimProposals(userId: string): Promise<void> {
  const { error } = await supabase
    .from("pending_venue_claims")
    .update({
      proposed_website: null,
      proposed_instagram: null,
      proposed_phone: null,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function approveOrganizerWithVenueClaim(
  userId: string,
  approverId: string,
): Promise<void> {
  const { data: claim, error: claimError } = await supabase
    .from("pending_venue_claims")
    .select("venue_id, proposed_website, proposed_instagram, proposed_phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claim) throw new Error("No pending claim found for this organizer.");

  const venueUpdates: { website?: string; instagram?: string; phone?: string } = {};
  if (claim.proposed_website) venueUpdates.website = claim.proposed_website;
  if (claim.proposed_instagram) venueUpdates.instagram = claim.proposed_instagram;
  if (claim.proposed_phone) venueUpdates.phone = claim.proposed_phone;
  if (Object.keys(venueUpdates).length > 0) {
    const { error: venueError } = await supabase
      .from("venues")
      .update(venueUpdates)
      .eq("id", claim.venue_id);
    if (venueError) throw venueError;
  }

  const { error: ownerError } = await supabase.from("venue_owners").insert({
    user_id: userId,
    venue_id: claim.venue_id,
  });
  if (ownerError) throw ownerError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      approval_status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  await supabase.from("pending_venue_claims").delete().eq("user_id", userId);
}

export async function approveOrganizerWithNewBar(
  userId: string,
  approverId: string,
): Promise<{ venueId: string; lat: number; lng: number }> {
  // Fetch the latest submission state (admin may have edited it after first load).
  const { data: sub, error: subError } = await supabase
    .from("pending_bar_submissions")
    .select("name, address, neighborhood, website, instagram, phone, lat, lng")
    .eq("user_id", userId)
    .maybeSingle();
  if (subError) throw subError;
  if (!sub) throw new Error("No pending submission found for this organizer.");

  // Resolve coordinates BEFORE any DB write — fail loud if neither manual
  // coords nor geocoding give us a usable lat/lng. Otherwise we'd produce
  // a venue that never appears on the map.
  let lat = sub.lat;
  let lng = sub.lng;
  if (lat == null || lng == null) {
    const geo = await geocodeAddress(sub.address);
    if (!geo) {
      throw new Error(
        "Geocoding failed for the given address. Please open the bar editor, enter the coordinates manually, then try approving again.",
      );
    }
    lat = geo.lat;
    lng = geo.lng;
  }

  // Insert a brand-new venue (FK to bars was dropped — venues is standalone now).
  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .insert({
      name: sub.name,
      address: sub.address,
      neighborhood: sub.neighborhood,
      website: sub.website,
      instagram: sub.instagram,
      phone: sub.phone,
      lat,
      lng,
    })
    .select("id")
    .single();
  if (venueError) throw venueError;
  const venueId = venueRow.id;

  const { error: ownerError } = await supabase.from("venue_owners").insert({
    user_id: userId,
    venue_id: venueId,
  });
  if (ownerError) throw ownerError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      approval_status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  await supabase.from("pending_bar_submissions").delete().eq("user_id", userId);

  return { venueId, lat, lng };
}

export async function updatePendingBarSubmission(
  userId: string,
  submission: {
    name: string;
    address: string;
    neighborhood: string;
    website: string | null;
    instagram: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("pending_bar_submissions")
    .update({
      name: submission.name,
      address: submission.address,
      neighborhood: submission.neighborhood,
      website: submission.website,
      instagram: submission.instagram,
      phone: submission.phone,
      lat: submission.lat,
      lng: submission.lng,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

type StagedEventRow = Tables<"venue_events_staging"> & {
  venues: Pick<Tables<"venues">, "name" | "address" | "neighborhood"> | null;
};

function mapStagedEventRow(row: StagedEventRow): StagedEvent {
  return {
    id: row.id,
    parentId: "",
    // Empty string (not null) keeps parity with BarlinEvent.venueId, so the
    // `!venueId` "needs a venue decision" checks read the same everywhere.
    venueId: row.venue_id ?? "",
    // A user submission with a typed (not-yet-created) venue has no `venues`
    // join row; fall back to the manual_venue_* the submitter entered.
    venueName: row.venues?.name ?? row.manual_venue_name ?? "(unknown venue)",
    venueAddress: row.venues?.address ?? row.manual_venue_address ?? "",
    venueNeighborhood: row.venues?.neighborhood ?? row.manual_venue_neighborhood ?? "",
    title: row.title ?? "",
    date: row.date ?? "",
    startTime: trimTime(row.start_time) || null,
    endTime: trimTime(row.end_time) || null,
    doorsTime: trimTime(row.doors_time) || null,
    category: row.category,
    language: row.language ?? "",
    description: row.description ?? "",
    entryInfo: row.entry_info ?? "",
    sourceUrl: row.source_url,
    // All staging rows are pending — approved live in `events`, reject deletes.
    status: "pending",
    scrapedAt: row.scraped_at,
    isManual: row.is_manual ?? false,
    createdByAdmin: row.created_by_admin ?? false,
    recurrence: row.recurrence ?? "",
    recurrenceUntil: row.recurrence_until ?? null,
    replacesEventId: row.replaces_event_id ?? null,
    createdBy: row.created_by ?? null,
    image: row.image ?? null,
    imagePosition: row.image_position ?? "50% 50%",
  };
}

export interface LiveEventInfo {
  id: string;
  date: string;
  startTime: string;
  title: string;
  status: string;
}

export async function fetchLiveEventsByVenue(): Promise<Record<string, LiveEventInfo[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("id, venue_id, date, start_time, title, status")
    .in("status", ["approved", "canceled"])
    .gte("date", today);
  if (error) throw error;
  const map: Record<string, LiveEventInfo[]> = {};
  for (const row of data) {
    if (row.venue_id && row.date) {
      (map[row.venue_id] ??= []).push({
        id: row.id,
        date: row.date,
        startTime: trimTime(row.start_time),
        title: row.title,
        status: row.status,
      });
    }
  }
  Object.values(map).forEach(arr =>
    arr.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))),
  );
  return map;
}

// Counts staging rows for the given scope. Staging only holds pending events
// (approved live in `events`, rejected get deleted), so no status filter.
export async function fetchStagedEventCount(
  scope: StagedEventScope = "any",
): Promise<number> {
  let query = supabase
    .from("venue_events_staging")
    .select("*", { count: "exact", head: true })
    // User submissions (created_by set) belong to the "User events" tab, not
    // the scraped/manual/recurring pipeline.
    .is("created_by", null);
  if (scope === "manual") {
    query = query.eq("is_manual", true).eq("recurrence", "");
  } else if (scope === "scraped") {
    query = query.eq("is_manual", false);
  } else if (scope === "recurring") {
    query = query.eq("is_manual", true).neq("recurrence", "");
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// Approved events live in `events` (not staging). The Approved tab shows only
// upcoming, one row per series (= the earliest non-past occurrence). When the
// archive cron eventually removes the series parent, the series survives in
// the tab via its earliest remaining child (which still carries parent_id).
// Scope splits by is_manual + "is row part of a series".
//
// Returns each row paired with its future-only sibling dates (sorted asc) so
// the admin live preview can show the "Upcoming events in this bar" accordion
// — the events table doesn't store recurrence_until, so we can't derive these
// post-hoc via generateOccurrences.
export interface ApprovedEventListItem {
  event: BarlinEvent;
  siblings: { id: string; date: string }[];
}

// Collapse a flat list of approved event rows into one representative per
// series (earliest upcoming occurrence) + its future sibling dates, then keep
// only rows matching `matchesScope`. Shared by fetchApprovedEvents (scoped by
// is_manual/series) and fetchApprovedUserEvents (scoped by creator role).
async function collapseApprovedEvents(
  data: Tables<"events">[],
  matchesScope: (row: Tables<"events">) => boolean,
): Promise<ApprovedEventListItem[]> {
  // Collapse each series to its earliest upcoming occurrence. Series id is the
  // parent's uuid (children reference it via parent_id; the parent — if still
  // alive — has parent_id='' and uses its own id as the key).
  const byKey = new Map<string, Tables<"events">>();
  // All future occurrences per series, with id+date so the admin can act on
  // each one individually (open / edit / cancel).
  const siblingsByKey = new Map<string, { id: string; date: string }[]>();
  for (const row of data) {
    const seriesKey = row.parent_id || row.id;
    if (row.date) {
      const list = siblingsByKey.get(seriesKey) ?? [];
      list.push({ id: row.id, date: row.date });
      siblingsByKey.set(seriesKey, list);
    }
    const existing = byKey.get(seriesKey);
    if (!existing) {
      byKey.set(seriesKey, row);
      continue;
    }
    const existingTime = `${existing.date} ${existing.start_time ?? ""}`;
    const rowTime = `${row.date} ${row.start_time ?? ""}`;
    if (rowTime < existingTime) byKey.set(seriesKey, row);
  }

  // The recurrence rule lives only on the parent row. When the parent's
  // date is in the past it gets filtered out by the caller's `gte("date",
  // today)`, leaving the earliest-upcoming child as the representative —
  // but children carry `recurrence = ""`. Without the rule, the admin
  // form's <select> falls back to its first option ("Weekly"), making it
  // look like the series is weekly *and* risking a wrong write if the
  // admin changes anything else. Fetch missing parents separately and
  // inject their recurrence into the representative row so the UI shows
  // the truth.
  const representatives = Array.from(byKey.values()).filter(matchesScope);
  const missingParentIds = Array.from(
    new Set(
      representatives
        .filter((row) => !!row.parent_id && !row.recurrence)
        .map((row) => row.parent_id as string),
    ),
  );
  const parentRules = new Map<string, string>();
  if (missingParentIds.length > 0) {
    const { data: parents } = await supabase
      .from("events")
      .select("id, recurrence")
      .in("id", missingParentIds);
    for (const p of parents ?? []) {
      if (p.recurrence) parentRules.set(p.id, p.recurrence);
    }
  }

  return representatives
    .map((row): ApprovedEventListItem => {
      const seriesKey = row.parent_id || row.id;
      const siblings = (siblingsByKey.get(seriesKey) ?? []).slice().sort(
        (a, b) => a.date.localeCompare(b.date),
      );
      const enriched =
        row.parent_id && !row.recurrence && parentRules.has(row.parent_id)
          ? { ...row, recurrence: parentRules.get(row.parent_id)! }
          : row;
      return { event: mapEventRow(enriched), siblings };
    })
    .sort((a, b) =>
      a.event.venue.localeCompare(b.event.venue, "de", { sensitivity: "base" })
      || a.event.date.localeCompare(b.event.date)
      || (a.event.startTime ?? "").localeCompare(b.event.startTime ?? ""),
    );
}

export async function fetchApprovedEvents(
  scope: StagedEventScope = "any",
): Promise<ApprovedEventListItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("events")
    .select("*")
    .eq("status", "approved")
    .gte("date", today);
  if (scope === "manual" || scope === "recurring") {
    query = query.eq("is_manual", true);
  } else if (scope === "scraped") {
    query = query.eq("is_manual", false);
  }
  const { data, error } = await query;
  if (error) throw error;

  // A row belongs to a series if it's a child (parent_id set) or a parent
  // (recurrence rule set). Singletons have neither.
  const matchesScope = (row: Tables<"events">) => {
    const inSeries = !!row.parent_id || !!row.recurrence;
    if (scope === "recurring") return inSeries;
    if (scope === "manual" || scope === "scraped") return !inSeries;
    return true;
  };

  return collapseApprovedEvents(data, matchesScope);
}

// Approved events submitted by plain users (creator role 'user'), for the
// "User events" tab's Approved filter. Upcoming-only, one row per series, same
// shape + card UI as fetchApprovedEvents. No scope split — singles and series
// both belong to the user. No FK on created_by, so resolve user ids first.
export async function fetchApprovedUserEvents(): Promise<ApprovedEventListItem[]> {
  const { data: users, error: usersError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .eq("role", "user");
  if (usersError) throw usersError;
  const ids = (users ?? []).map((u) => u.id);
  if (ids.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "approved")
    .gte("date", today)
    .in("created_by", ids);
  if (error) throw error;

  // Same profiles fetch that gave us the ids carries the submitter contact —
  // stamp it onto each event so the approved card shows who created it.
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  const items = await collapseApprovedEvents(data, () => true);
  return items.map((it) => {
    const p = it.event.createdBy ? byId.get(it.event.createdBy) : undefined;
    return p
      ? { ...it, event: { ...it.event, submitter: { email: p.email ?? "", firstName: p.first_name ?? "", lastName: p.last_name ?? "" } } }
      : it;
  });
}

// Returns all pending staging rows for the scope. Approved is served by
// fetchApprovedEvents (reads `events`); rejected rows don't exist (delete).
export async function fetchStagedEvents(
  scope: StagedEventScope = "any",
): Promise<StagedEvent[]> {
  let query = supabase
    .from("venue_events_staging")
    .select("*, venues!inner(name, address, neighborhood)")
    // User submissions (created_by set) belong to the "User events" tab, not
    // the scraped/manual/recurring pipeline.
    .is("created_by", null);

  if (scope === "manual") {
    query = query.eq("is_manual", true).eq("recurrence", "");
  } else if (scope === "scraped") {
    query = query.eq("is_manual", false);
  } else if (scope === "recurring") {
    query = query.eq("is_manual", true).neq("recurrence", "");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as StagedEventRow[]).map(mapStagedEventRow).sort((a, b) =>
    a.venueName.localeCompare(b.venueName, "de", { sensitivity: "base" })
    || a.date.localeCompare(b.date)
    || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
}

export async function createBlankManualStagedEvent(
  venueId: string,
  scope: "scraped" | "manual" | "recurring" = "scraped",
  sourceUrl: string | null = null,
): Promise<StagedEvent> {
  const id = crypto.randomUUID();
  // Scraped tab: row stays in scraped (is_manual=false) but is flagged
  // created_by_admin so the "Created manually" badge shows. Manual/recurring
  // tabs keep is_manual=true (their tab filter requires it).
  const isManual = scope !== "scraped";
  const { error } = await supabase
    .from("venue_events_staging")
    .insert({
      id,
      venue_id: venueId,
      is_manual: isManual,
      created_by_admin: true,
      source_url: cleanUrl(sourceUrl) || null,
      recurrence: scope === "recurring" ? "weekly" : "",
      recurrence_until: null,
    });
  if (error) throw error;

  const { data, error: fetchErr } = await supabase
    .from("venue_events_staging")
    .select("*, venues!inner(name, address, neighborhood)")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;
  return mapStagedEventRow(data as StagedEventRow);
}

export async function duplicateStagedEvent(
  source: StagedEvent,
  edits?: StagedEventEdits,
  scope: "scraped" | "manual" | "recurring" = "scraped",
): Promise<StagedEvent> {
  const id = crypto.randomUUID();
  const merged = {
    title: edits?.title ?? source.title,
    date: edits?.date ?? source.date,
    startTime: edits?.startTime !== undefined ? edits.startTime : source.startTime,
    endTime: edits?.endTime !== undefined ? edits.endTime : source.endTime,
    doorsTime: edits?.doorsTime !== undefined ? edits.doorsTime : source.doorsTime,
    category: edits?.category !== undefined ? edits.category : source.category,
    language: edits?.language ?? source.language,
    description: edits?.description ?? source.description,
    entryInfo: edits?.entryInfo ?? source.entryInfo,
    recurrence: edits?.recurrence ?? source.recurrence,
    recurrenceUntil: edits?.recurrenceUntil !== undefined ? edits.recurrenceUntil : source.recurrenceUntil,
  };
  // Scope drives where the duplicate appears:
  //   scraped   -> is_manual=false, recurrence='' (stays in scraped tab)
  //   manual    -> is_manual=true,  recurrence='' (stays in manual tab)
  //   recurring -> is_manual=true,  recurrence kept non-empty
  // created_by_admin always true so the "Created manually" badge shows.
  const isManual = scope !== "scraped";
  const recurrence = scope === "recurring" ? (merged.recurrence || "weekly") : "";
  const recurrenceUntil = scope === "recurring" ? merged.recurrenceUntil : null;
  const stagedTimes = normalizeStartDoors(merged.startTime, merged.doorsTime);
  const { error } = await supabase
    .from("venue_events_staging")
    .insert({
      id,
      venue_id: source.venueId,
      title: merged.title || null,
      date: merged.date || null,
      start_time: stagedTimes.start,
      end_time: merged.endTime ? trimTime(merged.endTime) : null,
      doors_time: stagedTimes.doors,
      category: merged.category,
      language: merged.language || null,
      description: merged.description || null,
      entry_info: merged.entryInfo || null,
      source_url: cleanUrl(edits?.sourceUrl !== undefined ? edits.sourceUrl : source.sourceUrl) || null,
      is_manual: isManual,
      created_by_admin: true,
      recurrence,
      recurrence_until: recurrenceUntil,
    });
  if (error) throw error;

  const { data, error: fetchErr } = await supabase
    .from("venue_events_staging")
    .select("*, venues!inner(name, address, neighborhood)")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;
  return mapStagedEventRow(data as StagedEventRow);
}

export async function updateStagedEventManualFields(
  stagedId: string,
  patch: { venueId?: string; sourceUrl?: string | null; recurrence?: string; recurrenceUntil?: string | null; image?: string | null; imagePosition?: string },
): Promise<void> {
  const update: TablesUpdate<"venue_events_staging"> = {};
  if (patch.venueId !== undefined) update.venue_id = patch.venueId;
  if (patch.sourceUrl !== undefined) update.source_url = cleanUrl(patch.sourceUrl) || null;
  if (patch.recurrence !== undefined) update.recurrence = patch.recurrence;
  if (patch.recurrenceUntil !== undefined) update.recurrence_until = patch.recurrenceUntil;
  if (patch.image !== undefined) update.image = patch.image;
  if (patch.imagePosition !== undefined) update.image_position = patch.imagePosition;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("venue_events_staging")
    .update(update)
    .eq("id", stagedId);
  if (error) throw error;
}

// Reclassifies a scraped staging row as a recurring one by flipping the
// scope-defining columns. The row stays put — only `is_manual`, `recurrence`,
// and `created_by_admin` change — so the realtime listener on
// venue_events_staging then routes the row to the Recurring tab on next fetch.
// recurrence_until stays null; the admin fills it in (and edits the freq if
// needed) in the Recurring tab before approving.
export async function moveStagedEventToRecurring(stagedId: string): Promise<void> {
  const { error } = await supabase
    .from("venue_events_staging")
    .update({
      is_manual: true,
      recurrence: "weekly",
      created_by_admin: true,
    })
    .eq("id", stagedId);
  if (error) throw error;
}

export async function approveStagedEvent(
  staged: StagedEvent,
  adminUserId: string,
  edits?: StagedEventEdits,
): Promise<void> {
  const merged = {
    title: edits?.title ?? staged.title,
    date: edits?.date ?? staged.date,
    startTime: edits?.startTime !== undefined ? edits.startTime : staged.startTime,
    endTime: edits?.endTime !== undefined ? edits.endTime : staged.endTime,
    doorsTime: edits?.doorsTime !== undefined ? edits.doorsTime : staged.doorsTime,
    category: edits?.category !== undefined ? edits.category : staged.category,
    language: edits?.language ?? staged.language,
    description: edits?.description ?? staged.description,
    entryInfo: edits?.entryInfo ?? staged.entryInfo,
    recurrence: edits?.recurrence ?? staged.recurrence,
    recurrenceUntil: edits?.recurrenceUntil !== undefined ? edits.recurrenceUntil : staged.recurrenceUntil,
  };

  if (!merged.title.trim()) throw new Error("Title is required");
  if (!merged.date) throw new Error("Date is required");
  if (!merged.category) throw new Error("Category is required");

  // An approved event must map to a real bar. User submissions with a typed
  // venue get one linked/created (createVenueForStagedSubmission) BEFORE this
  // runs, so a missing venue here is a programming error the callers prevent.
  const venueId = staged.venueId;
  if (!venueId) throw new Error("A venue is required to approve this event.");
  const venueName = staged.venueName;
  const venueAddress = staged.venueAddress;
  const venueNeighborhood = staged.venueNeighborhood;

  const approveTimes = normalizeStartDoors(merged.startTime, merged.doorsTime);
  const baseRow = (overrides: { id: string; date: string; parent_id: string; recurrence: string }): TablesInsert<"events"> => ({
    id: overrides.id,
    parent_id: overrides.parent_id,
    recurrence: overrides.recurrence,
    title: merged.title,
    venue: venueName,
    venue_id: venueId,
    address: venueAddress,
    neighborhood: venueNeighborhood,
    date: overrides.date,
    start_time: approveTimes.start,
    end_time: merged.endTime ? trimTime(merged.endTime) : null,
    doors_time: approveTimes.doors,
    category: merged.category!,
    language: merged.language || null,
    description: merged.description || null,
    url: cleanUrl(staged.sourceUrl) || null,
    entry_info: merged.entryInfo || null,
    // User submissions carry a cover image; scraper/admin rows don't (admins
    // add covers post-approve), so this stays null for them.
    image: staged.image ?? null,
    image_position: staged.imagePosition ?? "50% 50%",
    // Preserve the original submitter on user rows so the "User events
    // accepted" tab still resolves them by creator role; scraper/admin rows
    // (createdBy null) are attributed to the approving admin as before.
    created_by: staged.createdBy ?? adminUserId,
    status: "approved",
    approved_by: adminUserId,
    approved_at: new Date().toISOString(),
    is_manual: staged.isManual,
    // Community-submission marker: staging rows with a user submitter and
    // no admin-created flag are plain-user submissions. Bar owners + admins
    // skip staging entirely (createEvent writes straight to events), so the
    // default `false` covers them.
    submitted_by_user: !!staged.createdBy && !staged.createdByAdmin,
  });

  if (merged.recurrence) {
    const freq = merged.recurrence as RecurrenceFreq;
    // Indefinite when recurrenceUntil is null/undefined: materialize next 8w
    // window now; the extend_recurring_series cron job extends it daily.
    const isIndefinite = !merged.recurrenceUntil;
    const effectiveUntil = merged.recurrenceUntil
      ?? berlinDateStringOffset(56);
    const dates = generateOccurrences(merged.date, freq, effectiveUntil);
    if (dates.length === 0) throw new Error("No occurrences generated for recurring event.");

    const parentId = crypto.randomUUID();
    const parentRule = formatRule(freq, isIndefinite ? null : merged.recurrenceUntil);
    const rows: TablesInsert<"events">[] = dates.map((date, idx) =>
      baseRow({
        id: idx === 0 ? parentId : crypto.randomUUID(),
        date,
        parent_id: idx === 0 ? "" : parentId,
        recurrence: idx === 0 ? parentRule : "",
      }),
    );
    const { error: insertError } = await supabase.from("events").insert(rows);
    if (insertError) throw insertError;
  } else {
    const eventRow = baseRow({
      id: crypto.randomUUID(),
      date: merged.date,
      parent_id: "",
      recurrence: "",
    });
    const { error: insertError } = await supabase.from("events").insert(eventRow);
    if (insertError) throw insertError;
  }

  // Approval moves the event to `events`; the staging row is no longer needed.
  // `events` is the single source of truth for approved events from now on.
  const { error: deleteError } = await supabase
    .from("venue_events_staging")
    .delete()
    .eq("id", staged.id);
  if (deleteError) throw deleteError;
}

export interface AutoApproveResult {
  approved: number; // inserted as new live events
  updated: number;  // diverging fields patched onto an existing live event
  skipped: { title: string; reason: string }[];
}

// Same normalization as EventDiffModal / compare_event_fields — null vs ""
// vs whitespace must compare equal so we don't write back phantom diffs.
function normalizeUpdateField(key: string, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (key === "description") return v.replace(/\s+/g, " ");
  if (key === "sourceUrl") return v.toLowerCase();
  return v;
}

// Builds the patch an auto-approve run applies to a live event from a scraper
// update row: only the fields that actually diverge, and only the ones the
// scraper is allowed to write unattended. category and language are
// admin-curated (see EventUpdatePatch) — a human picks those in EventDiffModal,
// so they are deliberately excluded here even when they differ.
function autoUpdatePatch(staged: StagedEvent, live: BarlinEvent): EventUpdatePatch {
  const patch: EventUpdatePatch = {};
  const diff = (key: string, s: string | null, l: string | null) =>
    normalizeUpdateField(key, s) !== normalizeUpdateField(key, l);
  if (diff("title", staged.title, live.title)) patch.title = staged.title;
  if (diff("date", staged.date, live.date)) patch.date = staged.date;
  if (diff("startTime", staged.startTime, live.startTime)) patch.startTime = staged.startTime;
  if (diff("endTime", staged.endTime, live.endTime)) patch.endTime = staged.endTime;
  if (diff("doorsTime", staged.doorsTime, live.doorsTime)) patch.doorsTime = staged.doorsTime;
  if (diff("description", staged.description, live.description)) patch.description = staged.description;
  if (diff("entryInfo", staged.entryInfo, live.entryInfo)) patch.entryInfo = staged.entryInfo;
  if (diff("sourceUrl", staged.sourceUrl, live.url)) patch.sourceUrl = staged.sourceUrl;
  return patch;
}

// Bulk-handles pending scraped staging rows without per-card review, but ONLY
// the unambiguous ones. Two row kinds:
//   • Update rows (replacesEventId set): the scraper matched this to a live
//     event, so it patches the diverging fields onto that event instead of
//     inserting a new one. These "clash" with the very event they replace by
//     definition, so the same-bar/same-day skip must NOT apply to them.
//   • New rows: inserted as a new live event only when the bar has no other
//     event on that same day. Any clash leaves the row untouched for manual
//     review — nothing is ever overwritten.
// Scraped-scope rows are always non-recurring, so no series handling is needed.
// One failing row never aborts the batch.
export async function autoApproveScrapedEvents(
  staged: StagedEvent[],
  adminUserId: string,
): Promise<AutoApproveResult> {
  // Fresh map (today-onward, approved + canceled) so the clash check is correct
  // even if the dashboard's cached liveEventsByVenue is stale.
  const liveByVenue = await fetchLiveEventsByVenue();
  const result: AutoApproveResult = { approved: 0, updated: 0, skipped: [] };

  // Occupied (bar|day) slots. Seeded from every existing live event — approved
  // OR canceled both count as "the bar already has an event that day" — then
  // extended as we approve, so two scraped rows for the same new slot can't
  // both land.
  const claimedSlots = new Set<string>();
  for (const [venueId, events] of Object.entries(liveByVenue)) {
    for (const e of events) claimedSlots.add(`${venueId}|${e.date}`);
  }

  for (const s of staged) {
    const label = s.title || "(untitled)";
    try {
      // Update rows patch an existing event — never insert, never clash-skip.
      if (s.replacesEventId) {
        const live = await fetchEventById(s.replacesEventId);
        if (!live) {
          result.skipped.push({ title: label, reason: "live event to update no longer exists" });
          continue;
        }
        const patch = autoUpdatePatch(s, live);
        if (Object.keys(patch).length === 0) {
          // Nothing safe to apply — only admin-curated fields (category/
          // language) diverge, or the row is stale. Leave for manual review.
          result.skipped.push({ title: label, reason: "only admin-curated fields differ — review manually" });
          continue;
        }
        await applyEventUpdate(live.id, patch, s.id);
        result.updated++;
        continue;
      }

      if (!s.venueId) {
        result.skipped.push({ title: label, reason: "no venue linked" });
        continue;
      }
      if (!s.title.trim() || !s.date || !s.category) {
        result.skipped.push({ title: label, reason: "missing title, date or category" });
        continue;
      }

      const slot = `${s.venueId}|${s.date}`;
      if (claimedSlots.has(slot)) {
        // The bar already has an event that day (live, or another row approved
        // earlier in this run) — skip, never overwrite.
        result.skipped.push({ title: label, reason: "another event already exists in this bar that day" });
        continue;
      }

      await approveStagedEvent(s, adminUserId);
      claimedSlots.add(slot);
      result.approved++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "approve failed";
      result.skipped.push({ title: label, reason });
    }
  }

  return result;
}

// Reject hard-deletes the row from staging — no soft-state. The scraper's
// dedup is keyed on the live `events` table + remaining staging rows; once
// gone, a subsequent scrape may re-stage the same event (which is fine, the
// admin can reject again or approve it this time).
export async function rejectStagedEvent(stagedId: string): Promise<void> {
  const { error } = await supabase
    .from("venue_events_staging")
    .delete()
    .eq("id", stagedId);
  if (error) throw error;
}

export async function deleteStagedEvent(stagedId: string): Promise<void> {
  const { error } = await supabase
    .from("venue_events_staging")
    .delete()
    .eq("id", stagedId);
  if (error) throw error;
}

// --- Plain-user event submissions (routed through venue_events_staging) -------
// Plain users no longer write to `events`; their submissions land in
// venue_events_staging (created_by = their uid) and flow through the SAME
// moderation pipeline as scraped/manual/recurring rows. On approve they move
// into `events` like any other staging row. Bar owners / admins are unchanged
// — they still publish straight to `events`.

// Build a BarlinEvent from a staging submission so the existing admin/user
// "your events" cards (which speak BarlinEvent) can render it unchanged.
function stagedSubmissionToEvent(
  s: StagedEvent,
  overrides: { id: string; parentId: string; date: string; recurrence: string },
  submitter?: BarlinEvent["submitter"],
): BarlinEvent {
  return {
    id: overrides.id,
    parentId: overrides.parentId,
    title: s.title,
    venue: s.venueName,
    venueId: s.venueId,
    neighborhood: s.venueNeighborhood,
    address: s.venueAddress,
    date: overrides.date,
    startTime: s.startTime ?? "",
    endTime: s.endTime ?? undefined,
    doorsTime: s.doorsTime ?? undefined,
    category: s.category ?? "",
    description: s.description,
    entryInfo: s.entryInfo,
    language: s.language,
    recurrence: overrides.recurrence,
    url: s.sourceUrl ?? "",
    image: s.image ?? undefined,
    imagePosition: s.imagePosition ?? "50% 50%",
    interestedCount: 0,
    status: "pending",
    createdBy: s.createdBy ?? undefined,
    isManual: s.isManual,
    canceledBy: null,
    isHighlight: false,
    highlightPriority: 0,
    submitter,
    // Staging rows representing plain-user submissions (createdBy set,
    // createdByAdmin false) carry the badge through the dashboard preview
    // so the user sees what their event will look like once approved.
    isCommunitySubmission: !!s.createdBy && !s.createdByAdmin,
  };
}

// Create a user's submission as a single staging template row. Recurring is
// stored as rule + recurrence_until (NOT expanded) — approve expands it, same
// as every other staging row. RLS enforces created_by = auth.uid(),
// created_by_admin = false and replaces_event_id IS NULL server-side.
export async function createUserStagedSubmission(
  formData: EventWriteData,
  userId: string,
  imageUrl?: string,
): Promise<void> {
  const times = normalizeStartDoors(formData.startTime, formData.doorsTime);
  const hasVenue = !!formData.venueId;
  const row: TablesInsert<"venue_events_staging"> = {
    id: crypto.randomUUID(),
    // Existing public venue (directory picker) → venue_id; typed venue →
    // manual_venue_* for the admin to turn into a bar (or link) at approve.
    venue_id: formData.venueId || null,
    manual_venue_name: hasVenue ? null : (formData.venue || null),
    manual_venue_address: hasVenue ? null : (formData.address || null),
    manual_venue_neighborhood: hasVenue ? null : (formData.neighborhood || null),
    title: formData.title,
    date: formData.date,
    start_time: times.start,
    end_time: formData.endTime ? trimTime(formData.endTime) : null,
    doors_time: times.doors,
    category: formData.category,
    description: formData.description || null,
    entry_info: formData.entryInfo || null,
    language: formData.language || null,
    source_url: cleanUrl(formData.website) || null,
    image: imageUrl || null,
    image_position: formData.imagePosition,
    recurrence: formData.recurrence || "",
    recurrence_until: formData.recurrenceUntil || null,
    // Plain-user submissions mirror the old events behavior (is_manual=true).
    is_manual: true,
    created_by_admin: false,
    created_by: userId,
  };
  const { error } = await supabase.from("venue_events_staging").insert(row);
  if (error) throw error;
}

// The signed-in user's own pending submissions (RLS scopes to created_by =
// auth.uid()). One BarlinEvent per submission — recurring stays a single card
// (the rule drives the badge); we don't expand into synthetic child rows here
// because the dashboard's per-occurrence links would 404 (staging rows aren't
// routable until approved).
export async function fetchMyStagedSubmissions(userId: string): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("venue_events_staging")
    .select("*, venues(name, address, neighborhood)")
    .eq("created_by", userId);
  if (error) throw error;
  return (data as StagedEventRow[]).map(mapStagedEventRow).map((s) =>
    stagedSubmissionToEvent(
      s,
      {
        id: s.id,
        parentId: "",
        date: s.date,
        recurrence: s.recurrence ? formatRule(s.recurrence as RecurrenceFreq, s.recurrenceUntil) : "",
      },
    ),
  );
}

// Single staging row by id, scoped to the owner — backs the editor when a
// pending submission is opened from "Your events". Returns null if the row
// isn't there (admin already approved it, or it never belonged to the user).
export async function fetchMyStagedSubmissionById(
  stagingId: string,
  userId: string,
): Promise<BarlinEvent | null> {
  const { data, error } = await supabase
    .from("venue_events_staging")
    .select("*, venues(name, address, neighborhood)")
    .eq("id", stagingId)
    .eq("created_by", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const s = mapStagedEventRow(data as StagedEventRow);
  return stagedSubmissionToEvent(s, {
    id: s.id,
    parentId: "",
    date: s.date,
    recurrence: s.recurrence ? formatRule(s.recurrence as RecurrenceFreq, s.recurrenceUntil) : "",
  });
}

// Patch the owner's pending staging row. Field mapping mirrors the insert
// path in createUserStagedSubmission. The row stays "pending" — admin reviews
// the updated template on approve. Returns updated:false when 0 rows change
// (race: admin approved the row between load and save, so it's now in
// `events` and gone from staging) so the caller can surface a useful toast.
export async function updateUserStagedSubmission(
  stagingId: string,
  formData: EventWriteData,
  imageUrl?: string | null,
): Promise<{ updated: boolean }> {
  const times = normalizeStartDoors(formData.startTime, formData.doorsTime);
  const hasVenue = !!formData.venueId;
  const patch: TablesUpdate<"venue_events_staging"> = {
    venue_id: formData.venueId || null,
    manual_venue_name: hasVenue ? null : (formData.venue || null),
    manual_venue_address: hasVenue ? null : (formData.address || null),
    manual_venue_neighborhood: hasVenue ? null : (formData.neighborhood || null),
    title: formData.title,
    date: formData.date,
    start_time: times.start,
    end_time: formData.endTime ? trimTime(formData.endTime) : null,
    doors_time: times.doors,
    category: formData.category,
    description: formData.description || null,
    entry_info: formData.entryInfo || null,
    language: formData.language || null,
    source_url: cleanUrl(formData.website) || null,
    image_position: formData.imagePosition,
    recurrence: formData.recurrence || "",
    recurrence_until: formData.recurrenceUntil || null,
  };
  // Only touch the image column when the form actually changed it. Caller
  // passes `undefined` when unchanged, `null` to clear, a url to replace.
  if (imageUrl !== undefined) patch.image = imageUrl;

  const { data, error } = await supabase
    .from("venue_events_staging")
    .update(patch)
    .eq("id", stagingId)
    .select("id");
  if (error) throw error;
  return { updated: (data?.length ?? 0) > 0 };
}

// Owner-triggered withdrawal of a pending submission. Same race contract as
// update: { withdrawn: false } means 0 rows deleted (admin already approved
// the row, so it's in `events` now and no longer ours to remove).
export async function deleteUserStagedSubmission(
  stagingId: string,
): Promise<{ withdrawn: boolean }> {
  const { data, error } = await supabase
    .from("venue_events_staging")
    .delete()
    .eq("id", stagingId)
    .select("id");
  if (error) throw error;
  return { withdrawn: (data?.length ?? 0) > 0 };
}

// Resolve each row's submitter (email + name) from profiles via created_by.
// There's no FK on created_by (it points at auth.users, not profiles), so we
// batch-fetch the profiles rather than relying on a PostgREST embed. Rows whose
// creator can't be resolved keep no submitter rather than blocking the list.
async function attachStagedSubmitters(rows: StagedEvent[]): Promise<StagedEvent[]> {
  const ids = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => !!id))];
  if (ids.length === 0) return rows;
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .in("id", ids);
  if (error) return rows;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = r.createdBy ? byId.get(r.createdBy) : undefined;
    return p
      ? { ...r, submitter: { email: p.email ?? "", firstName: p.first_name ?? "", lastName: p.last_name ?? "" } }
      : r;
  });
}

// All pending user submissions for the admin "User events" tab, as StagedEvent
// rows so they render in the same StagedEventCard UI as scraped/recurring. Left
// join on venues (a typed-venue submission has none yet); mapStagedEventRow
// falls back to the manual_venue_* the submitter entered. Submitter contact is
// resolved so the moderator sees who created each event.
export async function fetchPendingUserSubmissions(): Promise<StagedEvent[]> {
  const { data, error } = await supabase
    .from("venue_events_staging")
    .select("*, venues(name, address, neighborhood)")
    .not("created_by", "is", null);
  if (error) throw error;
  const rows = (data as StagedEventRow[]).map(mapStagedEventRow).sort((a, b) =>
    a.venueName.localeCompare(b.venueName, "de", { sensitivity: "base" })
    || a.date.localeCompare(b.date)
    || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
  return attachStagedSubmitters(rows);
}

// Count of pending user submissions, for the "User events" tab badge.
export async function fetchPendingUserSubmissionCount(): Promise<number> {
  const { count, error } = await supabase
    .from("venue_events_staging")
    .select("*", { count: "exact", head: true })
    .not("created_by", "is", null);
  if (error) throw error;
  return count ?? 0;
}

// Create a brand-new bar from a typed-venue submission and LINK it to the
// staging row (sets venue_id) — without approving. The admin can then review
// and approve the row like any other. Coordinates resolve BEFORE any write so a
// geocoding miss leaves the submission untouched (still a typed venue).
export async function createVenueForStagedSubmission(
  stagingId: string,
  submission: SubmissionVenueData,
  coords?: { lat: number; lng: number },
): Promise<{ venueId: string }> {
  let lat = coords?.lat;
  let lng = coords?.lng;
  if (lat == null || lng == null) {
    const geo = await geocodeAddress(submission.address);
    if (!geo) {
      throw new Error(
        "Couldn't locate that address on the map, so the bar can't be created. Link the event to an existing bar, or reject it and ask the submitter for a more precise address.",
      );
    }
    lat = geo.lat;
    lng = geo.lng;
  }

  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .insert({
      name: submission.name,
      address: submission.address,
      neighborhood: submission.neighborhood,
      website: null,
      instagram: null,
      phone: null,
      lat,
      lng,
    })
    .select("id")
    .single();
  if (venueError) throw venueError;

  const { error: linkError } = await supabase
    .from("venue_events_staging")
    .update({ venue_id: venueRow.id })
    .eq("id", stagingId);
  if (linkError) throw linkError;

  return { venueId: venueRow.id };
}

// Field set the diff modal can apply from a staging update onto a live event.
// Mirrors compare_event_fields in scripts/scrape_venue_events.py — anything
// outside this set is admin-curated (category, language) and should NOT be
// auto-applied.
export type EventUpdatePatch = Partial<{
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  doorsTime: string | null;
  description: string | null;
  entryInfo: string | null;
  sourceUrl: string | null;
  category: string;
  language: string | null;
}>;

// Patches selected fields onto a live event row, then deletes the staging
// row that proposed the update. Fields the admin DIDN'T tick are untouched —
// crucial so manual edits on the live event survive an update apply.
export async function applyEventUpdate(
  eventId: string,
  patch: EventUpdatePatch,
  stagedRowId: string,
): Promise<void> {
  const update: TablesUpdate<"events"> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.date !== undefined) update.date = patch.date;
  // Normalize start/doors together. If both are in the patch, just normalize.
  // If only doors is patched, fetch the row's current start to decide whether
  // doors should be promoted (matches the rule: doors-without-start → start).
  if (patch.startTime !== undefined && patch.doorsTime !== undefined) {
    const times = normalizeStartDoors(patch.startTime, patch.doorsTime);
    update.start_time = times.start;
    update.doors_time = times.doors;
  } else if (patch.startTime !== undefined) {
    update.start_time = patch.startTime ? trimTime(patch.startTime) : null;
  } else if (patch.doorsTime !== undefined) {
    const { data: row, error: fetchErr } = await supabase
      .from("events")
      .select("start_time")
      .eq("id", eventId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    const times = normalizeStartDoors(row?.start_time ?? null, patch.doorsTime);
    if (!row?.start_time && times.start !== null) {
      update.start_time = times.start;
    }
    update.doors_time = times.doors;
  }
  if (patch.endTime !== undefined) update.end_time = patch.endTime ? trimTime(patch.endTime) : null;
  if (patch.description !== undefined) update.description = patch.description || null;
  if (patch.entryInfo !== undefined) update.entry_info = patch.entryInfo || null;
  if (patch.sourceUrl !== undefined) update.url = cleanUrl(patch.sourceUrl) || null;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.language !== undefined) update.language = patch.language || null;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("events").update(update).eq("id", eventId);
    if (error) throw error;
  }
  const { error: delError } = await supabase
    .from("venue_events_staging")
    .delete()
    .eq("id", stagedRowId);
  if (delError) throw delError;
}

// Hard-deletes an approved event from the `events` table, removing it from
// the public site entirely. When the row belongs to a series (parent_id set
// or recurrence rule on the parent), the whole series is wiped — admin
// "Delete" on an approved recurring card means "remove this from the site",
// not "skip one occurrence".
//
// Mirrors the user_interests cleanup pattern used by cancelEventSeries:
// clear user_interests first, then events. (RLS limits cross-user interest
// deletion, so a few orphan rows may remain — they become invisible because
// the events read RLS hides rows whose status isn't approved/canceled, and
// the underlying event is gone.)
export async function deleteApprovedEvent(
  displayedId: string,
  seriesId: string | null,
): Promise<void> {
  let eventIds: string[];
  if (seriesId) {
    const { data, error } = await supabase
      .from("events")
      .select("id")
      .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`);
    if (error) throw error;
    eventIds = (data ?? []).map(r => r.id);
  } else {
    eventIds = [displayedId];
  }

  if (eventIds.length === 0) return;

  const { error: interestErr } = await supabase
    .from("user_interests")
    .delete()
    .in("event_id", eventIds);
  if (interestErr) throw interestErr;

  const { error: deleteErr } = await supabase
    .from("events")
    .delete()
    .in("id", eventIds);
  if (deleteErr) throw deleteErr;
}

// Updates an approved event directly in the `events` table. When seriesId is
// non-null, shared fields apply across the whole series (parent if still
// alive, plus all children referencing it); date/time stay on the displayed
// row only — every occurrence keeps its own date.
//
//   • Singleton:           displayedId = row.id,        seriesId = null
//   • Live series parent:  displayedId = parent.id,     seriesId = parent.id
//   • Orphan series child: displayedId = child.id,      seriesId = parent.id
//     (parent already archived; the series id still anchors all children)
export async function updateApprovedEvent(
  displayedId: string,
  seriesId: string | null,
  edits: StagedEventEdits,
): Promise<void> {
  if (!edits.venueId) throw new Error("Venue is required");
  if (!edits.title?.trim()) throw new Error("Title is required");
  if (!edits.date) throw new Error("Date is required");
  if (!edits.category) throw new Error("Category is required");

  // Fetch the venue from the DB directly so this stays correct even if the
  // caller's local venues state is stale (other admin added/removed venues
  // since the dashboard was loaded).
  const { data: venue, error: venueErr } = await supabase
    .from("venues")
    .select("id, name, address, neighborhood")
    .eq("id", edits.venueId)
    .maybeSingle();
  if (venueErr || !venue) throw new Error("Venue not found");

  const seriesWide: TablesUpdate<"events"> = {
    title: edits.title,
    category: edits.category,
    language: edits.language || null,
    description: edits.description || null,
    entry_info: edits.entryInfo || null,
    url: cleanUrl(edits.sourceUrl) || null,
    venue: venue.name,
    venue_id: venue.id,
    address: venue.address,
    neighborhood: venue.neighborhood,
  };

  if (seriesId) {
    const { error: seriesErr } = await supabase
      .from("events")
      .update(seriesWide)
      .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`);
    if (seriesErr) throw seriesErr;

    const occTimes = normalizeStartDoors(edits.startTime, edits.doorsTime);
    const occurrenceOnly: TablesUpdate<"events"> = {
      date: edits.date,
      start_time: occTimes.start,
      end_time: edits.endTime ? trimTime(edits.endTime) : null,
      doors_time: occTimes.doors,
    };
    const { error: occErr } = await supabase
      .from("events")
      .update(occurrenceOnly)
      .eq("id", displayedId);
    if (occErr) throw occErr;
    return;
  }

  const singleTimes = normalizeStartDoors(edits.startTime, edits.doorsTime);
  const update: TablesUpdate<"events"> = {
    ...seriesWide,
    date: edits.date,
    start_time: singleTimes.start,
    end_time: edits.endTime ? trimTime(edits.endTime) : null,
    doors_time: singleTimes.doors,
  };
  const { error } = await supabase.from("events").update(update).eq("id", displayedId);
  if (error) throw error;
}

/** Set, replace or clear the cover image across a whole approved series (root +
 *  every child) so all occurrences share one cover — or a single approved event
 *  when `seriesId` is null. This is an admin override: unlike the image-backfill
 *  workflow (which only fills where `image IS NULL`), it overwrites existing
 *  covers. A new image resets `image_position` to the default; clearing leaves
 *  the column untouched. */
export async function updateApprovedEventImage(
  displayedId: string,
  seriesId: string | null,
  image: string | null,
): Promise<void> {
  const update: TablesUpdate<"events"> = { image };
  if (image) update.image_position = "50% 50%";
  const builder = supabase.from("events").update(update);
  const scoped = seriesId
    ? builder.or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    : builder.eq("id", displayedId);
  const { error } = await scoped;
  if (error) throw error;
}
