import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { BarlinEvent, StagedEvent, StagedEventEdits, StagedEventScope, StagedEventStatus, StagedEventStatusFilter, Venue } from "@/types/event";
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
    websiteEvents: row.website_events ?? undefined,
    online: row.online === "yes" ? "yes" : "no",
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}

export async function setVenueOnline(
  venueId: string,
  online: "yes" | "no",
): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ online })
    .eq("id", venueId);
  if (error) throw error;
}

export async function updateVenueLinks(
  venueId: string,
  patch: { website?: string | null; instagram?: string | null; websiteEvents?: string | null },
): Promise<void> {
  const update: TablesUpdate<"venues"> = {};
  if (patch.website !== undefined) update.website = patch.website;
  if (patch.instagram !== undefined) update.instagram = patch.instagram;
  if (patch.websiteEvents !== undefined) update.website_events = patch.websiteEvents;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("venues")
    .update(update)
    .eq("id", venueId);
  if (error) throw error;
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
      .select("user_id, venues ( id, name, address, neighborhood, website, instagram, phone )")
      .in("user_id", ids),
    supabase
      .from("pending_bar_submissions")
      .select("user_id, name, address, neighborhood, website, instagram, phone")
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
  const claimByUser = new Map<string, OrganizerAccount["pendingClaim"]>();
  for (const row of claimsRes.data ?? []) {
    const r = row as {
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
    if (!r.venues) continue;
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

type StagedEventRow = Tables<"venue_events_staging"> & {
  venues: Pick<Tables<"venues">, "name" | "address" | "neighborhood"> | null;
};

function mapStagedEventRow(row: StagedEventRow): StagedEvent {
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venues?.name ?? "(unknown venue)",
    venueAddress: row.venues?.address ?? "",
    venueNeighborhood: row.venues?.neighborhood ?? "",
    title: row.title ?? "",
    date: row.date ?? "",
    startTime: row.start_time,
    endTime: row.end_time,
    category: row.category,
    language: row.language ?? "",
    description: row.description ?? "",
    entryInfo: row.entry_info ?? "",
    sourceUrl: row.source_url,
    status: row.status as StagedEventStatus,
    scrapedAt: row.scraped_at,
    reviewedAt: row.reviewed_at,
    isManual: row.is_manual ?? false,
    isManualTab: row.is_manual_tab ?? false,
    eventsId: row.events_id ?? null,
  };
}

export interface LiveEventInfo {
  id: string;
  date: string;
  startTime: string;
  title: string;
}

export async function fetchLiveEventsByVenue(): Promise<Record<string, LiveEventInfo[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("id, venue_id, date, start_time, title")
    .in("status", ["approved", "canceled"])
    .gte("date", today);
  if (error) throw error;
  const map: Record<string, LiveEventInfo[]> = {};
  for (const row of data) {
    if (row.venue_id && row.date) {
      (map[row.venue_id] ??= []).push({
        id: row.id,
        date: row.date,
        startTime: row.start_time ?? "",
        title: row.title,
      });
    }
  }
  Object.values(map).forEach(arr =>
    arr.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))),
  );
  return map;
}

export async function fetchStagedEvents(
  statusFilter: StagedEventStatusFilter = "pending",
  scope: StagedEventScope = "any",
): Promise<StagedEvent[]> {
  let query = supabase
    .from("venue_events_staging")
    .select("*, venues!inner(name, address, neighborhood)");

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (scope === "manual") {
    query = query.eq("is_manual_tab", true);
  } else if (scope === "scraped") {
    query = query.eq("is_manual_tab", false);
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
  scope: "scraped" | "manual" = "scraped",
): Promise<StagedEvent> {
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("venue_events_staging")
    .insert({
      id,
      venue_id: venueId,
      status: "pending",
      is_manual: true,
      is_manual_tab: scope === "manual",
      source_url: null,
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
): Promise<StagedEvent> {
  const id = crypto.randomUUID();
  const merged = {
    title: edits?.title ?? source.title,
    date: edits?.date ?? source.date,
    startTime: edits?.startTime !== undefined ? edits.startTime : source.startTime,
    endTime: edits?.endTime !== undefined ? edits.endTime : source.endTime,
    category: edits?.category !== undefined ? edits.category : source.category,
    language: edits?.language ?? source.language,
    description: edits?.description ?? source.description,
    entryInfo: edits?.entryInfo ?? source.entryInfo,
  };
  const { error } = await supabase
    .from("venue_events_staging")
    .insert({
      id,
      venue_id: source.venueId,
      title: merged.title || null,
      date: merged.date || null,
      start_time: merged.startTime,
      end_time: merged.endTime,
      category: merged.category,
      language: merged.language || null,
      description: merged.description || null,
      entry_info: merged.entryInfo || null,
      source_url: edits?.sourceUrl !== undefined ? edits.sourceUrl : source.sourceUrl,
      status: "pending",
      is_manual: true,
      is_manual_tab: source.isManualTab,
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
  patch: { venueId?: string; sourceUrl?: string | null },
): Promise<void> {
  const update: TablesUpdate<"venue_events_staging"> = {};
  if (patch.venueId !== undefined) update.venue_id = patch.venueId;
  if (patch.sourceUrl !== undefined) update.source_url = patch.sourceUrl;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("venue_events_staging")
    .update(update)
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
    category: edits?.category !== undefined ? edits.category : staged.category,
    language: edits?.language ?? staged.language,
    description: edits?.description ?? staged.description,
    entryInfo: edits?.entryInfo ?? staged.entryInfo,
  };

  if (!merged.title.trim()) throw new Error("Title is required");
  if (!merged.date) throw new Error("Date is required");
  if (!merged.startTime) throw new Error("Start time is required");
  if (!merged.category) throw new Error("Category is required");

  const eventRow: TablesInsert<"events"> = {
    id: crypto.randomUUID(),
    parent_id: "",
    recurrence: "",
    title: merged.title,
    venue: staged.venueName,
    venue_id: staged.venueId,
    address: staged.venueAddress,
    neighborhood: staged.venueNeighborhood,
    date: merged.date,
    start_time: merged.startTime,
    end_time: merged.endTime || null,
    category: merged.category,
    language: merged.language || null,
    description: merged.description || null,
    url: staged.sourceUrl || null,
    entry_info: merged.entryInfo || null,
    image: null,
    image_position: "50% 50%",
    created_by: adminUserId,
    status: "approved",
    approved_by: adminUserId,
    approved_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from("events").insert(eventRow);
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("venue_events_staging")
    .update({
      status: "approved",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      events_id: eventRow.id,
    })
    .eq("id", staged.id);
  if (updateError) throw updateError;
}

export async function rejectStagedEvent(
  stagedId: string,
  adminUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from("venue_events_staging")
    .update({
      status: "rejected",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", stagedId);
  if (error) throw error;
}

export async function updateApprovedStagedEvent(
  staged: StagedEvent,
  edits: StagedEventEdits,
  venues: Venue[],
): Promise<void> {
  if (!staged.eventsId) {
    throw new Error("Cannot edit — no link to live event");
  }
  const newVenueId = edits.venueId ?? staged.venueId;
  const venue = venues.find(v => v.id === newVenueId);
  if (!venue) throw new Error("Venue not found");

  const merged = {
    title: edits.title ?? staged.title,
    date: edits.date ?? staged.date,
    startTime: edits.startTime !== undefined ? edits.startTime : staged.startTime,
    endTime: edits.endTime !== undefined ? edits.endTime : staged.endTime,
    category: edits.category !== undefined ? edits.category : staged.category,
    language: edits.language ?? staged.language,
    description: edits.description ?? staged.description,
    entryInfo: edits.entryInfo ?? staged.entryInfo,
    sourceUrl: edits.sourceUrl !== undefined ? edits.sourceUrl : staged.sourceUrl,
  };

  if (!merged.title.trim()) throw new Error("Title is required");
  if (!merged.date) throw new Error("Date is required");
  if (!merged.startTime) throw new Error("Start time is required");
  if (!merged.category) throw new Error("Category is required");

  const eventsUpdate: TablesUpdate<"events"> = {
    title: merged.title,
    date: merged.date,
    start_time: merged.startTime,
    end_time: merged.endTime || null,
    category: merged.category,
    language: merged.language || null,
    description: merged.description || null,
    entry_info: merged.entryInfo || null,
    url: merged.sourceUrl,
    venue: venue.name,
    venue_id: venue.id,
    address: venue.address,
    neighborhood: venue.neighborhood,
  };
  const { error: eventsErr } = await supabase
    .from("events")
    .update(eventsUpdate)
    .eq("id", staged.eventsId);
  if (eventsErr) throw eventsErr;

  const stagingUpdate: TablesUpdate<"venue_events_staging"> = {
    title: merged.title,
    date: merged.date,
    start_time: merged.startTime,
    end_time: merged.endTime,
    category: merged.category,
    language: merged.language || null,
    description: merged.description || null,
    entry_info: merged.entryInfo || null,
    source_url: merged.sourceUrl,
    venue_id: venue.id,
  };
  const { error: stagingErr } = await supabase
    .from("venue_events_staging")
    .update(stagingUpdate)
    .eq("id", staged.id);
  if (stagingErr) throw stagingErr;
}
