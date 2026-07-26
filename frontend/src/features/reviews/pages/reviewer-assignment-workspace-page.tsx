"use client";

import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DeadlineIndicator,
  InvitationStatusBadge,
  ReviewRoundLabel,
} from "@/features/editorial/components";
import {
  ReviewReportForm,
  ReviewerAssignmentCard,
} from "@/features/reviews/components";
import {
  useReviewerAssignments,
  useReviewerManuscriptDownload,
} from "@/features/reviews/hooks";
import {
  isActiveReviewOverdue,
  isMandatoryRevisionAssignment,
} from "@/features/reviews/reviewer-assignment-state";

interface ReviewerAssignmentWorkspacePageProps {
  assignmentId: string;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The blinded manuscript could not be prepared.";
}

export function ReviewerAssignmentWorkspacePage({
  assignmentId,
}: ReviewerAssignmentWorkspacePageProps) {
  const assignmentsQuery = useReviewerAssignments();
  const manuscriptDownload = useReviewerManuscriptDownload();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const assignment = assignmentsQuery.data?.find(
    (item) => item.id === assignmentId,
  );

  const handleDownload = async () => {
    setDownloadError(null);

    try {
      const response = await manuscriptDownload.mutateAsync({ assignmentId });
      const link = document.createElement("a");
      link.href = response.manuscript_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setDownloadError(getErrorMessage(error));
    }
  };

  if (assignmentsQuery.isPending) {
    return (
      <LoadingState
        label="Loading review workspace"
        className="min-h-[50vh]"
      />
    );
  }

  if (assignmentsQuery.isError) {
    return (
      <ErrorState
        title="Review workspace unavailable"
        description={
          assignmentsQuery.error instanceof Error
            ? assignmentsQuery.error.message
            : "The assignment could not be loaded."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reviewer/invitations"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft aria-hidden="true" />
              Back to workspace
            </Link>
            <Button
              type="button"
              size="sm"
              onClick={() => assignmentsQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        }
      />
    );
  }

  if (!assignment) {
    return (
      <ErrorState
        title="Assignment not available"
        description="This assignment does not exist in your reviewer workspace or is not available to your account."
        action={
          <Link
            href="/reviewer/invitations"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft aria-hidden="true" />
            Back to workspace
          </Link>
        }
      />
    );
  }

  const isActive =
    assignment.status === "ACCEPTED" && !assignment.review_submitted;
  const isCompleted = assignment.review_submitted;
  const isMandatoryRevision = isMandatoryRevisionAssignment(assignment);
  const isOverdue = isActiveReviewOverdue(assignment);
  const hasRevisionResponse =
    assignment.version.version_number > 1 &&
    Boolean(assignment.version.response_to_reviewers?.trim());

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Reviewer assignment"
        title={assignment.submission.title}
        description="Review only the blinded manuscript version assigned to this round. Your recommendation supports—but does not replace—the editor’s decision."
        breadcrumbs={
          <Link
            href="/reviewer/invitations"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Reviewer workspace
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {assignmentsQuery.isFetching ? (
              <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                role="status"
              >
                <RefreshCw
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Refreshing
              </span>
            ) : null}
            <ReviewRoundLabel
              versionNumber={assignment.version.version_number}
            />
            <InvitationStatusBadge
              status={assignment.status}
              reviewSubmitted={assignment.review_submitted}
              isOverdue={isOverdue}
            />
          </div>
        }
      />

      {assignment.status === "PENDING" ? (
        <ReviewerAssignmentCard assignment={assignment} variant="invitation" />
      ) : isActive || isCompleted ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <main className="min-w-0 space-y-6">
            {isMandatoryRevision ? (
              <Alert variant="info">
                <RotateCcw aria-hidden="true" />
                <AlertTitle>
                  Version {assignment.version.version_number} requires your
                  review
                </AlertTitle>
                <AlertDescription>
                  This is a mandatory continuation of your accepted assignment.
                  Review the revised blinded file and the author response below;
                  there is no new accept or decline step.
                </AlertDescription>
              </Alert>
            ) : null}

            {isCompleted ? (
              <Alert variant="success">
                <CheckCircle2 aria-hidden="true" />
                <AlertTitle>Review submitted and locked</AlertTitle>
                <AlertDescription>
                  This assignment is read-only. The current reviewer endpoint
                  confirms submission but does not return the report text for
                  later display.
                </AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Blinded manuscript overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <h2 className="font-medium">Abstract</h2>
                  <p
                    className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground"
                    dir="auto"
                  >
                    {assignment.submission.abstract}
                  </p>
                </div>

                {hasRevisionResponse ? (
                  <details
                    className="rounded-lg border border-primary/20 bg-primary/5 p-4"
                    open={isMandatoryRevision}
                  >
                    <summary className="cursor-pointer font-medium">
                      Author response to previous reviews
                    </summary>
                    <p
                      className="mt-3 whitespace-pre-wrap text-sm leading-7"
                      dir="auto"
                    >
                      {assignment.version.response_to_reviewers}
                    </p>
                  </details>
                ) : null}

                <Alert variant="info">
                  <ShieldCheck aria-hidden="true" />
                  <AlertTitle>Double-blind review access</AlertTitle>
                  <AlertDescription>
                    The download contains only the blinded file for version{" "}
                    {assignment.version.version_number}. Author identities,
                    private submission files, and editorial-only records are
                    not shown here.
                  </AlertDescription>
                </Alert>

                {downloadError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Download unavailable</AlertTitle>
                    <AlertDescription>{downloadError}</AlertDescription>
                  </Alert>
                ) : null}

                {assignment.can_download_manuscript ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-muted-foreground">
                      The secure download link is temporary and opens in a new
                      tab.
                    </p>
                    <Button
                      type="button"
                      size="touch"
                      variant="outline"
                      disabled={manuscriptDownload.isPending}
                      onClick={handleDownload}
                    >
                      <Download aria-hidden="true" />
                      {manuscriptDownload.isPending
                        ? "Preparing blinded file…"
                        : "Download blinded manuscript"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {isActive ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Review instructions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
                      <li>
                        Evaluate the manuscript’s rigor, clarity, originality,
                        ethics, and fit for the journal section.
                      </li>
                      <li>
                        Give specific, constructive author-facing feedback
                        without identifying yourself.
                      </li>
                      <li>
                        Put sensitive concerns only in the confidential editor
                        field.
                      </li>
                      <li>
                        Submit once the report is complete; the backend treats
                        submission as final.
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {assignment.can_submit_review ? (
                  <ReviewReportForm assignment={assignment} />
                ) : (
                  <Alert variant="warning">
                    <AlertTitle>Report submission is not available</AlertTitle>
                    <AlertDescription>
                      Refresh the assignment to obtain its latest workflow
                      permissions. No report fields have been enabled without
                      backend authorization.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : null}
          </main>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Assignment details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Section</dt>
                    <dd className="mt-1 font-medium">
                      {assignment.submission.section}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Language</dt>
                    <dd className="mt-1 font-medium">
                      {assignment.submission.language.toUpperCase()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Manuscript version
                    </dt>
                    <dd className="mt-1 font-medium">
                      Version {assignment.version.version_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Assigned</dt>
                    <dd className="mt-1">
                      <time dateTime={assignment.assigned_at}>
                        {formatDateTime(assignment.assigned_at)}
                      </time>
                    </dd>
                  </div>
                  <DeadlineIndicator
                    deadline={assignment.review_deadline}
                    isOverdue={isOverdue}
                    kind="review"
                  />
                </dl>
              </CardContent>
            </Card>

            <Alert>
              <FileText aria-hidden="true" />
              <AlertTitle>Round-specific record</AlertTitle>
              <AlertDescription>
                Your work is tied to version{" "}
                {assignment.version.version_number}. Previous reviewer reports
                are not exposed by the current reviewer contract.
              </AlertDescription>
            </Alert>
          </aside>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Closed assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              This invitation is {assignment.status.toLowerCase()} and no
              reviewer actions are available. Internal editorial cancellation
              notes are not displayed.
            </p>
            <Link
              href="/reviewer/invitations"
              className={buttonVariants({ variant: "outline" })}
            >
              <ArrowLeft aria-hidden="true" />
              Return to reviewer workspace
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
