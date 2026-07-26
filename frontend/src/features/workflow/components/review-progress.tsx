import type { ManagerReviewProgress } from "@/features/workflow/types";

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ReviewProgress({
  progress,
}: {
  progress: ManagerReviewProgress;
}) {
  const completionPercentage =
    progress.invitations_accepted > 0
      ? Math.min(
          100,
          Math.round(
            (progress.reviews_submitted / progress.invitations_accepted) * 100,
          ),
        )
      : 0;

  const hasOverdueItems =
    progress.overdue_invitations > 0 || progress.overdue_reviews > 0;

  return (
    <div
      aria-label="Reviewer invitation and review progress"
      className="space-y-3"
    >
      <div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">Reviews submitted</span>
          <span className="text-muted-foreground">
            {progress.reviews_submitted} of {progress.invitations_accepted}{" "}
            accepted
          </span>
        </div>

        {progress.invitations_accepted > 0 ? (
          <div
            role="progressbar"
            aria-label="Submitted reviews among accepted invitations"
            aria-valuemin={0}
            aria-valuemax={progress.invitations_accepted}
            aria-valuenow={progress.reviews_submitted}
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            No reviewer invitations have been accepted yet.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
        <div>
          <dt className="text-xs text-muted-foreground">Invited</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.invitations_total}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted-foreground">Pending</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.invitations_pending}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted-foreground">Accepted</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.invitations_accepted}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted-foreground">Submitted</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.reviews_submitted}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted-foreground">Declined</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.invitations_declined}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted-foreground">Expired</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.invitations_expired}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cancelled</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">
            {progress.invitations_cancelled}
          </dd>
        </div>
      </dl>

      {hasOverdueItems ? (
        <div
          aria-label="Overdue review warnings"
          className="space-y-1 rounded-md border border-status-danger-border bg-status-danger-subtle p-2 text-xs font-medium text-status-danger-foreground"
        >
          {progress.overdue_invitations > 0 ? (
            <p>
              {formatCount(progress.overdue_invitations, "overdue invitation")}
            </p>
          ) : null}

          {progress.overdue_reviews > 0 ? (
            <p>{formatCount(progress.overdue_reviews, "overdue review")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
