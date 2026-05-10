import { Spinner } from "@/components/ui/spinner";
import { useDelayedShow } from "@/hooks/useDelayedShow";

export default function IndexSkeleton() {
  const show = useDelayedShow(100);
  if (!show) return null;
  return (
    <div
      className="flex flex-1 items-center justify-center bg-background py-24"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size="lg" />
    </div>
  );
}
