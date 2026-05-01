import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchEvents,
  fetchEventById,
  fetchEventSeries,
  fetchVenues,
  fetchCategories,
  fetchInterestedEvents,
  checkInterest,
  fetchProfile,
  hasEventsAfter,
} from "@/lib/supabaseQueries";

export function useEvents(untilDate?: string) {
  return useQuery({
    queryKey: untilDate ? ["events", "until", untilDate] : ["events"],
    queryFn: () => fetchEvents(untilDate),
    placeholderData: keepPreviousData,
  });
}

export function useHasEventsAfter(date: string, enabled = true) {
  return useQuery({
    queryKey: ["events", "has-after", date],
    queryFn: () => hasEventsAfter(date),
    enabled,
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
  return useQuery({
    queryKey: ["events", "series", seriesId],
    queryFn: () => fetchEventSeries(seriesId),
    enabled: !!seriesId,
  });
}

export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: fetchVenues });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}

export function useMyEvents(userId: string | null) {
  return useQuery({
    queryKey: ["my-events", userId],
    queryFn: () => fetchInterestedEvents(userId!),
    enabled: !!userId,
  });
}

export function useCheckInterest(userId: string | null, eventId: string) {
  return useQuery({
    queryKey: ["interest", userId, eventId],
    queryFn: () => checkInterest(userId!, eventId),
    enabled: !!userId && !!eventId,
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}
