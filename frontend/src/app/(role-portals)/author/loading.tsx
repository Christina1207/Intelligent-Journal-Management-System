import { Skeleton } from "@/components/ui/skeleton";

export default function AuthorAreaLoading() {
  return (
    <div className="space-y-7" role="status" aria-label="Loading author page">
      <div className="border-b border-border pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-10 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-36 lg:col-span-2" />
        <Skeleton className="h-36" />
        <Skeleton className="h-64 lg:col-span-3" />
      </div>
    </div>
  );
}
