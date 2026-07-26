import { EmptyState } from "@/components/common/empty-state"

export function AuthorSubmissionsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          My Submissions
        </h1>
        <p className="text-sm text-muted-foreground">
          Author submission lists and drafts will be connected here later.
        </p>
      </div>
      <EmptyState
        title="No submission UI implemented yet"
        description="Submission upload and editing are intentionally left out of this foundation pass."
      />
    </section>
  )
}
