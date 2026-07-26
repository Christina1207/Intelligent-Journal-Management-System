import { Skeleton } from "@/components/ui/skeleton";

export function AuthFormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md" aria-label="Loading account form">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-6 h-10 w-64 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full" />
      <div className="mt-8 grid gap-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
