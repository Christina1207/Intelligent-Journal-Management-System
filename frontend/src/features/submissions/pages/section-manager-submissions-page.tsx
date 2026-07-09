import { EmptyState } from "@/components/common/empty-state"

export function SectionManagerSubmissionsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Managed Submissions
        </h1>
        <p className="text-sm text-muted-foreground">
          Section manager submission queues will be composed from the submissions
          feature.
        </p>
      </div>
      <EmptyState
        title="No section manager queue connected yet"
        description="Reviewer assignment and editorial queue logic are not implemented in this foundation step."
      />
    </section>
  )
}
