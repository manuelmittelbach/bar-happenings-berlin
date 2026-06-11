import { useCallback } from "react";
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
import { berlinDateString } from "@/lib/dateFormat";
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
    // Persist + serve from cache so the recurrence label ("Every Tuesday")
    // appears synchronously on revisit instead of popping in after the
    // series fetch resolves. Same trade-off as categories: if an organizer
    // adds/cancels an occurrence between visits, the cached series can be
    // briefly stale until the user manually refreshes — acceptable for
    // display-only label/isLastInSeries logic.
    staleTime: Infinity,
    gcTime: Infinity,
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

// Warm a venue's upcoming-events query before the user opens its page. Called
// on pointer-enter / pointer-down of a bar card, so by the time BarDetail
// mounts the data is usually already in cache and the "Upcoming events"
// spinner never has to show. Uses the SAME queryKey + queryFn as
// useEventsByVenue so BarDetail reads the prefetched entry directly.
// prefetchQuery is a no-op when the data is already fresh (respects staleTime),
// so repeated hovers don't re-hit the DB.
export function usePrefetchVenueEvents() {
  const queryClient = useQueryClient();
  return useCallback(
    (venueId: string) => {
      if (!venueId) return;
      const fromDate = berlinDateString();
      queryClient.prefetchQuery({
        queryKey: ["events", "venue", venueId, fromDate],
        queryFn: async () => {
          const events = await fetchEventsByVenue(venueId, fromDate);
          seedEvents(queryClient, events);
          return events;
        },
      });
    },
    [queryClient],
  );
}

export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: fetchVenues });
}

export function useVenueById(venueId: string) {
  // Reuses the full-venues list cache so opening multiple bar pages
  // doesn't trigger N separate requests. The list is small (< few
  // hundred bars), so client-side filter is cheap.
  const { data: venues, isLoading, error, refetch, isFetching } = useVenues();
  const venue = venues?.find((v) => v.id === venueId) ?? null;
  return { venue, isLoading, error, refetch, isFetching };
}

export function useCategories() {
  // Categories are effectively a stable enum. staleTime: Infinity + the
  // persisted query cache (see App.tsx) means: fetched once, then served
  // from localStorage on every subsequent visit / deep-link, so the
  // category color/label is available synchronously on first paint. React
  // Query will still refetch on demand (e.g. cache invalidation after an
  // admin edit).
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}
