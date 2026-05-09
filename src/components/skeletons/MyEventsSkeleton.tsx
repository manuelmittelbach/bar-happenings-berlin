import { Skeleton } from "@/components/ui/skeleton";
import { SlowConnectionHint } from "@/components/ui/slow-connection-hint";
import { useDelayedShow } from "@/hooks/useDelayedShow";

function EventCardRowSkeleton() {
  return (
    <div className="border-2 border-border bg-background p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-[80%]" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-5 w-24" />
    </div>
  );
}

function DateSectionSkeleton() {
  return (
    <div>
      <Skeleton className="h-7 w-32 mb-4" />
      <div className="grid grid-cols-1 gap-6">
        <EventCardRowSkeleton />
        <EventCardRowSkeleton />
      </div>
    </div>
  );
}

export function MyEventsListSkeleton() {
  const show = useDelayedShow(100);
  if (!show) return null;
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <DateSectionSkeleton />
      <DateSectionSkeleton />
      <div className="pt-4 flex justify-center">
        <SlowConnectionHint />
      </div>
    </div>
  );
}

export default function MyEventsSkeleton() {
  const show = useDelayedShow(100);
  if (!show) return null;
  return (
    <div className="bg-background pb-24" aria-busy="true" aria-live="polite">
      <div className="max-w-screen-sm mx-auto px-4 pt-6">
        {/* "Discover events" CTA placeholder */}
        <div className="mt-12 mb-8 flex justify-center">
          <Skeleton className="h-11 w-44" />
        </div>

        <div className="space-y-8">
          <DateSectionSkeleton />
          <DateSectionSkeleton />
        </div>

        <div className="pt-8 flex justify-center">
          <SlowConnectionHint />
        </div>
      </div>
    </div>
  );
}
