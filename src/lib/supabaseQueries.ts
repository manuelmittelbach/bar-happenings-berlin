import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { BarlinEvent, Venue } from "@/types/event";
import { formatRule, generateOccurrences, type RecurrenceFreq } from "@/lib/recurrence";

function mapEventRow(row: Tables<"events">): BarlinEvent {
  return {
    id: row.id,
    parentId: row.parent_id ?? "",
    title: row.title,
    venue: row.venue,
    venueId: row.venue_id ?? "",
    neighborhood: row.neighborhood,
    address: row.address,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    category: row.category,
    categoryId: row.category_id ?? "",
    tags: row.tags ?? [],
    description: row.description ?? "",
    price: row.price ?? "",
    entryInfo: row.entry_info ?? "",
    language: row.language ?? "",
    recurrence: row.recurrence ?? "",
    url: row.url ?? "",
    image: row.image ?? undefined,
    imagePosition: row.image_position ?? "50% 50%",
    summary: row.summary ?? undefined,
    interestedCount: row.interested_count ?? 0,
    featured: row.featured ?? false,
    status: row.status,
    createdBy: row.created_by ?? undefined,
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
    instagram: row.instagram ?? undefined,
    website: row.website ?? undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}

export async function fetchEvents(): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["approved", "canceled"])
    .order("date")
    .order("start_time");
  if (error) throw error;
  return data.map(mapEventRow);
}

export async function fetchEventsByCreator(userId: string): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("created_by", userId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data.map(mapEventRow);
}

export async function fetchEventById(id: string): Promise<BarlinEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return mapEventRow(data);
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

interface EventWriteData {
  title: string; venue: string; address: string; neighborhood: string;
  date: string; startTime: string; endTime: string; category: string;
  description: string; entryInfo: string; language: string; website: string;
  imagePosition: string;
  recurrence: string; recurrenceUntil: string;
}

function buildEventRow(
  formData: EventWriteData,
  userId: string,
  imageUrl: string | undefined,
  overrides: { id: string; date: string; parent_id: string; recurrence: string },
): TablesInsert<"events"> {
  return {
    id: overrides.id,
    parent_id: overrides.parent_id,
    recurrence: overrides.recurrence,
    title: formData.title,
    venue: formData.venue,
    address: formData.address,
    neighborhood: formData.neighborhood,
    date: overrides.date,
    start_time: formData.startTime,
    end_time: formData.endTime || null,
    category: formData.category,
    description: formData.description || null,
    entry_info: formData.entryInfo || null,
    language: formData.language || null,
    url: formData.website || null,
    image: imageUrl || null,
    image_position: formData.imagePosition,
    created_by: userId,
    status: "approved",
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

function buildUpdatePatch(formData: EventWriteData, imageUrl: string | null | undefined, includeDateTime: boolean): TablesUpdate<"events"> {
  const update: TablesUpdate<"events"> = {
    title: formData.title,
    venue: formData.venue,
    address: formData.address,
    neighborhood: formData.neighborhood,
    category: formData.category,
    description: formData.description || null,
    entry_info: formData.entryInfo || null,
    language: formData.language || null,
    url: formData.website || null,
    image_position: formData.imagePosition,
  };
  if (includeDateTime) {
    update.date = formData.date;
    update.start_time = formData.startTime;
    update.end_time = formData.endTime || null;
  }
  if (imageUrl !== undefined) update.image = imageUrl;
  return update;
}

export async function updateEvent(
  id: string,
  formData: EventWriteData,
  imageUrl?: string | null,
): Promise<void> {
  const update = buildUpdatePatch(formData, imageUrl, true);
  const { error } = await supabase.from("events").update(update).eq("id", id);
  if (error) throw error;
}

export async function updateEventSeries(
  seriesId: string,
  fromDate: string,
  formData: EventWriteData,
  imageUrl?: string | null,
): Promise<void> {
  const update = buildUpdatePatch(formData, imageUrl, false);
  const { error } = await supabase
    .from("events")
    .update(update)
    .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    .gte("date", fromDate);
  if (error) throw error;
}

export async function cancelEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").update({ status: "canceled" }).eq("id", id);
  if (error) throw error;
}

export async function cancelEventSeries(seriesId: string, fromDate: string): Promise<void> {
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
    .update({ status: "canceled" })
    .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    .eq("date", fromDate);
  if (updateErr) throw updateErr;
}

export async function fetchEventSeries(seriesId: string): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .or(`id.eq.${seriesId},parent_id.eq.${seriesId}`)
    .order("date");
  if (error) throw error;
  return data.map(mapEventRow);
}

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from("venues").select("*");
  if (error) throw error;
  return data.map(mapVenueRow);
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

export async function saveInterest(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from("user_interests")
    .upsert({ user_id: userId, event_id: eventId }, { onConflict: "user_id,event_id" });
  if (error) throw error;
}

export async function deleteInterest(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from("user_interests")
    .delete()
    .eq("user_id", userId)
    .eq("event_id", eventId);
  if (error) throw error;
}

export async function checkInterest(userId: string, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_interests")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data;
}

export async function fetchInterestedEvents(userId: string): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("user_interests")
    .select("event_id, events(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.events as Tables<"events"> | null)
    .filter((e): e is Tables<"events"> => e !== null)
    .map(mapEventRow);
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
  } | null;
  pendingSubmission: {
    name: string;
    address: string;
    neighborhood: string;
    website: string | null;
    instagram: string | null;
    phone: string | null;
  } | null;
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
  const [ownersRes, submissionsRes] = await Promise.all([
    supabase
      .from("venue_owners")
      .select("user_id, venues ( id, name, address, neighborhood, website, instagram, phone )")
      .in("user_id", ids),
    supabase
      .from("pending_bar_submissions")
      .select("user_id, name, address, neighborhood, website, instagram, phone")
      .in("user_id", ids),
  ]);
  if (ownersRes.error) throw ownersRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
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
    };
    submissionByUser.set(r.user_id, {
      name: r.name,
      address: r.address,
      neighborhood: r.neighborhood,
      website: r.website,
      instagram: r.instagram,
      phone: r.phone,
    });
  }
  return profiles.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    approvalStatus: row.approval_status as OrganizerAccount["approvalStatus"],
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    venue: venueByUser.get(row.id) ?? null,
    pendingSubmission: submissionByUser.get(row.id) ?? null,
  }));
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
  return hydrateOrganizers(data as OrganizerProfileRow[]);
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
  },
): Promise<void> {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ first_name: profile.firstName, last_name: profile.lastName })
    .eq("id", userId);
  if (profileError) throw profileError;

  const { error: venueError } = await supabase
    .from("venues")
    .update({
      name: venue.name,
      address: venue.address,
      neighborhood: venue.neighborhood,
      website: venue.website,
      instagram: venue.instagram,
      phone: venue.phone,
    })
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
  // On reject: clean up any pending submission so the organizer entry doesn't keep dangling data.
  if (status === "rejected") {
    await supabase.from("pending_bar_submissions").delete().eq("user_id", userId);
  }
}

export async function approveOrganizerWithNewBar(
  userId: string,
  approverId: string,
): Promise<void> {
  // Fetch the latest submission state (admin may have edited it after first load).
  const { data: sub, error: subError } = await supabase
    .from("pending_bar_submissions")
    .select("name, address, neighborhood, website, instagram, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (subError) throw subError;
  if (!sub) throw new Error("No pending submission found for this organizer.");

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
      lat: 0,
      lng: 0,
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
    })
    .eq("user_id", userId);
  if (error) throw error;
}
