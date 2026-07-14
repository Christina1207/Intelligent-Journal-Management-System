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
          <span className="font-medium text-slate-700">Reviews submitted</span>
          <span className="text-slate-500">
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
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-[width]"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            No reviewer invitations have been accepted yet.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
        <div>
          <dt className="text-xs text-slate-500">Invited</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {progress.invitations_total}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Pending</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {progress.invitations_pending}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Accepted</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {progress.invitations_accepted}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Submitted</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {progress.reviews_submitted}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Declined</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {progress.invitations_declined}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Expired</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {progress.invitations_expired}
          </dd>
        </div>
      </dl>

      {hasOverdueItems ? (
        <div
          aria-label="Overdue review warnings"
          className="space-y-1 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700"
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
