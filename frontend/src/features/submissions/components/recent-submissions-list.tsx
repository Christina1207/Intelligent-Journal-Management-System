import Link from "next/link";

import type { AuthorDashboardSubmission } from "@/features/submissions/types";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";

type RecentSubmissionsListProps = {
  submissions: AuthorDashboardSubmission[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function RecentSubmissionsList({
  submissions,
}: RecentSubmissionsListProps) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Recent submissions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your latest manuscript activity.
          </p>
        </div>

        <Link
          href="/author/submissions"
          className="text-sm font-medium text-slate-700 hover:text-slate-950"
        >
          View all
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          You have not submitted any manuscripts yet.
        </div>
      ) : (
        <div className="mt-5 divide-y">
          {submissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/author/submissions/${submission.id}`}
              className="block py-4 transition hover:bg-slate-50"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-slate-950">
                    {submission.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {submission.section} · Submitted{" "}
                    {formatDate(submission.submitted_at)}
                  </p>
                </div>

                <SubmissionStatusBadge status={submission.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
