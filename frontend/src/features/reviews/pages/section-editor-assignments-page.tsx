import { EmptyState } from "@/components/common/empty-state"

export function SectionEditorAssignmentsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editorial Assignments
        </h1>
        <p className="text-sm text-muted-foreground">
          Section editor assignment views will live in the reviews feature.
        </p>
      </div>
      <EmptyState
        title="No assignment UI implemented yet"
        description="Assignment handling will be added only after the reviews API contract exists."
      />
    </section>
  )
}
