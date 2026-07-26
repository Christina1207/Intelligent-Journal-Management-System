import { Skeleton } from "@/components/ui/skeleton";

export default function AuthorRouteLoading() {
  return (
    <div
      className="space-y-7"
      role="status"
      aria-label="Loading author workspace page"
    >
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <span className="sr-only">Loading author workspace content…</span>
    </div>
  );
}
