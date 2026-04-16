import { useQuery } from "@tanstack/react-query";
import {
  fetchEvents,
  fetchEventById,
  fetchEventsByParentId,
  fetchVenues,
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

export function useEventsByParentId(parentId: string) {
  return useQuery({
    queryKey: ["events", "parent", parentId],
    queryFn: () => fetchEventsByParentId(parentId),
    enabled: !!parentId,
  });
}

export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: fetchVenues });
}
