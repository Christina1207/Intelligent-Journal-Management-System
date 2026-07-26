import { Skeleton } from "@/components/ui/skeleton"

export default function PublicLoading() {
  return (
    <div role="status" aria-label="Loading page">
      <section className="border-b border-border bg-surface-elevated">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-5 h-10 w-full max-w-xl" />
          <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-5 w-3/5 max-w-xl" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </section>
      <span className="sr-only">Loading journal content…</span>
    </div>
  )
}
