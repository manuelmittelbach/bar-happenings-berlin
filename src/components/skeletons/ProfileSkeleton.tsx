import { Skeleton } from "@/components/ui/skeleton";
import { SlowConnectionHint } from "@/components/ui/slow-connection-hint";

export default function ProfileSkeleton() {
  return (
    <div
      className="container max-w-2xl py-10 md:py-14"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header */}
      <div className="mb-10 md:mb-14 border-b-2 border-foreground pb-6">
        <Skeleton className="h-10 md:h-12 w-40" />
      </div>

      {/* Identity block */}
      <section className="mb-10 space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
        <Skeleton className="h-11 w-40 mt-2" />

        <div className="mt-8 pt-6 border-t border-border space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
          <Skeleton className="h-11 w-40" />
        </div>
      </section>

      {/* Security block */}
      <section className="mb-10 border-t border-border pt-8 space-y-4">
        <Skeleton className="h-3 w-32" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-44" />
      </section>

      <section className="border-t border-border pt-8">
        <Skeleton className="h-11 w-32" />
      </section>

      <div className="pt-8 flex justify-center">
        <SlowConnectionHint />
      </div>
    </div>
  );
}
