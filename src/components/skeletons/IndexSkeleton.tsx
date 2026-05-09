import { Skeleton } from "@/components/ui/skeleton";
import { SlowConnectionHint } from "@/components/ui/slow-connection-hint";
import { useDelayedShow } from "@/hooks/useDelayedShow";

function EventCardSkeleton() {
  return (
    <div className="border-2 border-border bg-background overflow-hidden">
      <div className="p-3 md:p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 md:h-7 w-[85%]" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between mt-1">
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

function DateSectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function IndexSkeleton() {
  const show = useDelayedShow(100);
  if (!show) return null;
  return (
    <section className="bg-background" aria-busy="true" aria-live="polite">
      <div className="container py-8 space-y-12">
        <DateSectionSkeleton count={4} />
        <DateSectionSkeleton count={4} />
        <div className="flex justify-center pt-4">
          <SlowConnectionHint />
        </div>
      </div>
    </section>
  );
}
