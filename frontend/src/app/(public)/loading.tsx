import { Skeleton } from "@/components/ui/skeleton";

export default function PublicRouteLoading() {
  return (
    <div role="status" aria-label="Loading journal page">
      <div className="border-b border-border bg-surface-elevated">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
      <span className="sr-only">Loading journal content…</span>
    </div>
  );
}
