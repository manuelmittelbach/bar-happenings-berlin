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
    .order("date")
    .order("start_time");
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

export async function fetchProfile(userId: string): Promise<{ firstName: string; lastName: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { firstName: data.first_name, lastName: data.last_name };
}
