import { useQuery, useQueryClient, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import {
  fetchEvents,
  fetchEventById,
  fetchEventSeries,
  fetchEventsByVenue,
  fetchVenues,
  fetchCategories,
  fetchProfile,
} from "@/lib/supabaseQueries";
import type { BarlinEvent } from "@/types/event";

// Seed individual event cache entries from a list result. When the user later
// clicks one of these events, useEventById hits the cache instead of doing a
// fresh round-trip — collapses the EventDetail waterfall by one request.
function seedEvents(queryClient: QueryClient, events: BarlinEvent[]) {
  for (const e of events) queryClient.setQueryData(["event", e.id], e);
}

export function useEvents(untilDate?: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: untilDate ? ["events", "until", untilDate] : ["events"],
    queryFn: async () => {
      const events = await fetchEvents(untilDate);
      seedEvents(queryClient, events);
      return events;
    },
    placeholderData: keepPreviousData,
  });
}

export function useEventById(id: string) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEventById(id),
    enabled: !!id,
  });
}

export function useEventSeries(seriesId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["events", "series", seriesId],
    queryFn: async () => {
      const events = await fetchEventSeries(seriesId);
      seedEvents(queryClient, events);
      return events;
    },
    enabled: !!seriesId,
  });
}

export function useEventsByVenue(venueId: string, fromDate: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["events", "venue", venueId, fromDate],
    queryFn: async () => {
      const events = await fetchEventsByVenue(venueId, fromDate);
      seedEvents(queryClient, events);
      return events;
    },
    enabled: !!venueId && !!fromDate,
  });
}

export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: fetchVenues });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}
