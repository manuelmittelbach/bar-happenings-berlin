import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { BarlinEvent, Venue } from "@/data/mockData";

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
    .eq("status", "approved")
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

export async function fetchEventsByParentId(parentId: string): Promise<BarlinEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("parent_id", parentId)
    .order("date");
  if (error) throw error;
  return data.map(mapEventRow);
}

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from("venues").select("*");
  if (error) throw error;
  return data.map(mapVenueRow);
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

export async function fetchProfile(userId: string): Promise<{ firstName: string; lastName: string; role: string; approvalStatus: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, role, approval_status")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { firstName: data.first_name, lastName: data.last_name, role: data.role, approvalStatus: data.approval_status };
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
  const { data: owners, error } = await supabase
    .from("venue_owners")
    .select("user_id, venues ( id, name, address, neighborhood, website, instagram, phone )")
    .in("user_id", ids);
  if (error) throw error;
  const venueByUser = new Map<string, OrganizerAccount["venue"]>();
  for (const row of owners ?? []) {
    const v = (row as { user_id: string; venues: OrganizerAccount["venue"] | null }).venues;
    if (v) venueByUser.set((row as { user_id: string }).user_id, v);
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
  const patch: Record<string, unknown> = { approval_status: status };
  if (status === "approved") {
    patch.approved_by = approverId ?? null;
    patch.approved_at = new Date().toISOString();
  } else {
    patch.approved_by = null;
    patch.approved_at = null;
  }
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
}
