import { useQuery } from "@tanstack/react-query";
import {
  fetchEvents,
  fetchEventById,
  fetchEventSeries,
  fetchVenues,
  fetchInterestedEvents,
  checkInterest,
  fetchProfile,
} from "@/lib/supabaseQueries";

export function useEvents() {
  return useQuery({ queryKey: ["events"], queryFn: fetchEvents });
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
