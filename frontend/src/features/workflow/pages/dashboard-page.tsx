import { EmptyState } from "@/components/common/empty-state"

export function DashboardPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A workflow overview will appear here once backend dashboard APIs are
          available.
        </p>
      </div>
      <EmptyState
        title="No dashboard data connected yet"
        description="This placeholder keeps the app route thin while reserving the dashboard area for editorial workflow metrics."
      />
    </section>
  )
}
