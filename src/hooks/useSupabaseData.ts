import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BarlinEvent, Venue, CategoryInfo } from "@/data/mockData";

// Map Supabase snake_case row to camelCase BarlinEvent
function mapEvent(row: any): BarlinEvent {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    venue: row.venue,
    venueId: row.venue_id,
    neighborhood: row.neighborhood,
    address: row.address,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    category: row.category,
    categoryId: row.category_id,
    tags: row.tags ?? [],
    description: row.description,
    price: row.price,
    entryInfo: row.entry_info,
    language: row.language,
    recurrence: row.recurrence,
    url: row.url,
    image: row.image ?? undefined,
    summary: row.summary ?? undefined,
    interestedCount: row.interested_count ?? 0,
    featured: row.featured ?? false,
  };
}

export function useEvents() {
  return useQuery<BarlinEvent[]>({
    queryKey: ["events"],
    queryFn: async () => {
      // Supabase default limit is 1000, we need all events
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapEvent);
    },
  });
}

export function useEventById(id: string | undefined) {
  return useQuery<BarlinEvent | null>({
    queryKey: ["event", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapEvent(data) : null;
    },
  });
}

export function useVenues() {
  return useQuery<Venue[]>({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVenueById(id: string | undefined) {
  return useQuery<Venue | null>({
    queryKey: ["venue", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useCategories() {
  return useQuery<CategoryInfo[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEventsByVenue(venueId: string | undefined) {
  return useQuery<BarlinEvent[]>({
    queryKey: ["events-by-venue", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("venue_id", venueId!);
      if (error) throw error;
      return (data ?? []).map(mapEvent);
    },
  });
}

export function useEventsByParent(parentId: string | undefined) {
  return useQuery<BarlinEvent[]>({
    queryKey: ["events-by-parent", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("parent_id", parentId!)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapEvent);
    },
  });
}
