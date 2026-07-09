import { EmptyState } from "@/components/common/empty-state"

export function ReviewerInvitationsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Review Invitations
        </h1>
        <p className="text-sm text-muted-foreground">
          Reviewer invitations will be connected through the reviews feature.
        </p>
      </div>
      <EmptyState
        title="No invitations connected yet"
        description="Accept, decline, and review report flows are intentionally out of scope here."
      />
    </section>
  )
}
