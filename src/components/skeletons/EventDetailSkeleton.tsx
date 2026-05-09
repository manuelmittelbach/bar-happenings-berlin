import { Skeleton } from "@/components/ui/skeleton";
import { SlowConnectionHint } from "@/components/ui/slow-connection-hint";
import { useDelayedShow } from "@/hooks/useDelayedShow";

export default function EventDetailSkeleton() {
  const show = useDelayedShow(100);
  if (!show) return null;
  return (
    <div className="bg-background pb-24" aria-busy="true" aria-live="polite">
      <div className="max-w-screen-md mx-auto">
        {/* Hero */}
        <Skeleton className="h-[180px] md:h-[260px] w-full rounded-none" />

        {/* Title */}
        <div className="px-4 pt-4 pb-1 space-y-2">
          <Skeleton className="h-7 md:h-9 w-[85%]" />
          <Skeleton className="h-7 md:h-9 w-[60%]" />
        </div>

        {/* Interested + share buttons */}
        <div className="px-4 pb-4 pt-3 flex items-center gap-3">
          <Skeleton className="h-12 w-40 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        <div className="border-t border-border mx-4" />

        {/* When / Where blocks */}
        <div className="px-4 py-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        </div>

        <div className="border-t border-border mx-4" />

        {/* Description */}
        <div className="px-4 py-6 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>

        <div className="px-4 pt-2 flex justify-center">
          <SlowConnectionHint />
        </div>
      </div>
    </div>
  );
}
