import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionHeader } from "@/components/common/section-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { formatSubmissionDate } from "@/features/submissions/submission-formatters";
import type { AuthorDashboardSubmission } from "@/features/submissions/types";

type RecentSubmissionsListProps = {
  submissions: AuthorDashboardSubmission[];
};

export function RecentSubmissionsList({
  submissions,
}: RecentSubmissionsListProps) {
  return (
    <section aria-labelledby="recent-submissions-heading">
      <SectionHeader
        title="Recent submissions"
        titleId="recent-submissions-heading"
        description="Your latest manuscript activity."
        action={
          <Link
            href="/author/submissions"
            className={buttonVariants({ variant: "ghost", size: "touch" })}
          >
            View all
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      {submissions.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<FileText aria-hidden="true" />}
          title="No submissions yet"
          description="Start a new manuscript when you are ready to submit work to the journal."
          action={
            <Link
              href="/author/submissions/new"
              className={buttonVariants({ variant: "accent", size: "touch" })}
            >
              New submission
            </Link>
          }
        />
      ) : (
        <Card className="mt-4 py-0">
          <CardContent className="divide-y divide-border p-0">
            {submissions.map((submission) => {
              const submittedDate = formatSubmissionDate(
                submission.submitted_at,
              );

              return (
                <Link
                  key={submission.id}
                  href={`/author/submissions/${submission.id}`}
                  className="group flex min-h-20 flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <h3
                      className="line-clamp-2 font-heading font-medium text-foreground"
                      dir="auto"
                    >
                      {submission.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {submission.section}
                      {submittedDate ? ` · Submitted ${submittedDate}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:ml-auto">
                    <SubmissionStatusBadge status={submission.status} />
                    <ArrowRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
