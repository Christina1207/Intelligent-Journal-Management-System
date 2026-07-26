"use client";

import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DeadlineIndicator,
  InvitationStatusBadge,
  isDeadlinePast,
  ReviewRoundLabel,
} from "@/features/editorial/components";
import { useEditorReviewWorkspace } from "@/features/reviews/hooks";
import type { EditorReview, ReviewerAssignment } from "@/features/reviews/types";
import { EditorDecisionForm } from "@/features/reviews/components/editor-decision-form";

interface EditorReviewProgressPanelProps {
  submissionId: string;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function assignmentDeadline(assignment: ReviewerAssignment) {
  return assignment.status === "PENDING"
    ? assignment.response_deadline
    : assignment.review_deadline;
}

function assignmentDeadlinePassed(assignment: ReviewerAssignment) {
  return assignment.is_overdue || isDeadlinePast(assignmentDeadline(assignment));
}

function ReviewCard({ review }: { review: EditorReview }) {
  return (
    <article className="space-y-4 rounded-lg border bg-background p-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
        <h4 className="font-medium" dir="auto">
          {review.reviewer.full_name}
        </h4>
          <p className="text-sm text-muted-foreground">
            {review.reviewer.email} · Submitted{" "}
            {formatDateTime(review.submitted_at)}
          </p>
        </div>

        <Badge variant="secondary">{review.recommendation}</Badge>
      </header>

      <div>
        <h5 className="text-sm font-medium">Comments for the author</h5>
        <p
          className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
          dir="auto"
        >
          {review.comments_for_author}
        </p>
      </div>

      {review.comments_for_editor ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <h5 className="text-sm font-medium text-amber-950">
            Confidential comments for the editor
          </h5>
          <p
            className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-900"
            dir="auto"
          >
            {review.comments_for_editor}
          </p>
        </div>
      ) : null}
    </article>
  );
}

export function EditorReviewProgressPanel({
  submissionId,
}: EditorReviewProgressPanelProps) {
  const workspaceQuery = useEditorReviewWorkspace(submissionId);

  if (workspaceQuery.isPending) {
    return (
      <section className="space-y-3" aria-busy="true">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </section>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Review progress unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {workspaceQuery.error instanceof Error
              ? workspaceQuery.error.message
              : "The review workspace could not be loaded."}
          </p>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => workspaceQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const workspace = workspaceQuery.data;
  const assignments = workspace.assignments;

  const counts = {
    total: assignments.length,
    pending: assignments.filter((assignment) => assignment.status === "PENDING")
      .length,
    accepted: assignments.filter(
      (assignment) => assignment.status === "ACCEPTED",
    ).length,
    declined: assignments.filter(
      (assignment) => assignment.status === "DECLINED",
    ).length,
    expired: assignments.filter((assignment) => assignment.status === "EXPIRED")
      .length,
    cancelled: assignments.filter(
      (assignment) => assignment.status === "CANCELLED",
    ).length,
    submitted: assignments.filter((assignment) => assignment.review_submitted)
      .length,
    overdueInvitations: assignments.filter(
      (assignment) =>
        assignment.status === "PENDING" &&
        assignmentDeadlinePassed(assignment),
    ).length,
    overdueReviews: assignments.filter(
      (assignment) =>
        assignment.status === "ACCEPTED" &&
        !assignment.review_submitted &&
        assignmentDeadlinePassed(assignment),
    ).length,
  };

  const progressPercentage =
    workspace.required_reviews > 0
      ? Math.min(
          100,
          Math.round((counts.submitted / workspace.required_reviews) * 100),
        )
      : 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Peer-review progress</h2>

            {workspace.current_version ? (
              <ReviewRoundLabel
                versionNumber={workspace.current_version.version_number}
              />
            ) : null}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Monitor invitations, deadlines, and submitted reports for
            {workspace.current_version
              ? ` version ${workspace.current_version.version_number}.`
              : " the current review round."}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={workspaceQuery.isFetching}
          onClick={() => workspaceQuery.refetch()}
        >
          <RefreshCw
            className={workspaceQuery.isFetching ? "animate-spin" : ""}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Invitations</p>
          <p className="mt-1 text-xl font-semibold">{counts.total}</p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Accepted</p>
          <p className="mt-1 text-xl font-semibold">{counts.accepted}</p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Reviews submitted</p>
          <p className="mt-1 text-xl font-semibold">
            {counts.submitted} / {workspace.required_reviews}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Overdue work</p>
          <p className="mt-1 text-xl font-semibold">
            {counts.overdueInvitations + counts.overdueReviews}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span>Required review completion</span>
          <span className="font-medium">{progressPercentage}%</span>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Required reviews submitted"
          aria-valuemin={0}
          aria-valuemax={workspace.required_reviews}
          aria-valuenow={Math.min(counts.submitted, workspace.required_reviews)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {counts.overdueInvitations > 0 || counts.overdueReviews > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Editorial attention required</AlertTitle>
          <AlertDescription>
            {counts.overdueInvitations > 0
              ? `${counts.overdueInvitations} invitation response ${
                  counts.overdueInvitations === 1 ? "is" : "are"
                } overdue. `
              : ""}
            {counts.overdueReviews > 0
              ? `${counts.overdueReviews} accepted ${
                  counts.overdueReviews === 1 ? "review is" : "reviews are"
                } overdue.`
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p className="rounded-md bg-muted/40 px-3 py-2">
          Pending: <strong>{counts.pending}</strong>
        </p>
        <p className="rounded-md bg-muted/40 px-3 py-2">
          Declined: <strong>{counts.declined}</strong>
        </p>
        <p className="rounded-md bg-muted/40 px-3 py-2">
          Expired: <strong>{counts.expired}</strong>
        </p>
      </div>

      {counts.cancelled > 0 ? (
        <p className="text-sm text-muted-foreground">
          Cancelled assignments: {counts.cancelled}
        </p>
      ) : null}

      <Separator />

      <section className="space-y-3">
        <h3 className="font-medium">Reviewer assignments</h3>

        {assignments.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No reviewer invitations have been sent for this round.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {assignments.map((assignment) => {
              const deadline = assignmentDeadline(assignment);

              return (
                <article
                  key={assignment.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium" dir="auto">
                      {assignment.reviewer.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {assignment.reviewer.email}
                    </p>
                    <div className="mt-2">
                      <ReviewRoundLabel
                        versionNumber={assignment.version.version_number}
                      />
                    </div>
                    <DeadlineIndicator
                      deadline={deadline}
                      isOverdue={assignment.is_overdue}
                      kind={
                        assignment.status === "PENDING" ? "response" : "review"
                      }
                      className="mt-3"
                    />
                  </div>

                  <InvitationStatusBadge
                    status={assignment.status}
                    reviewSubmitted={assignment.review_submitted}
                    isOverdue={assignmentDeadlinePassed(assignment)}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h3 className="font-medium">Submitted reviews</h3>
          <p className="text-sm text-muted-foreground">
            Reviewer identities and confidential comments are visible only in
            this editor workspace.
          </p>
        </div>

        {workspace.reviews_available ? (
          workspace.reviews.length > 0 ? (
            <div className="space-y-3">
              {workspace.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Review access is available, but no reports were returned.
            </p>
          )
        ) : (
          <Alert>
            <Clock3 aria-hidden="true" />
            <AlertTitle>Reviews not yet available</AlertTitle>
            <AlertDescription>
              {workspace.reviews_unavailable_reason ||
                "Review reports become available after the required review workflow is complete."}
            </AlertDescription>
          </Alert>
        )}
      </section>

      {workspace.can_make_decision ? (
        <>
          <Alert>
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Ready for editorial decision</AlertTitle>
            <AlertDescription>
              The required reviews have been submitted. Review the reports
              before recording the editorial decision.
            </AlertDescription>
          </Alert>

          <EditorDecisionForm submissionId={submissionId} />
        </>
      ) : null}
    </section>
  );
}
