"use client";

import { useState } from "react";
import { Download, FileCheck2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DeadlineIndicator,
  InvitationStatusBadge,
  isDeadlinePast,
  ReviewRoundLabel,
} from "@/features/editorial/components";
import { ReviewReportForm } from "@/features/reviews/components/review-report-form";
import {
  useRespondToReviewInvitation,
  useReviewerManuscriptDownload,
} from "@/features/reviews/hooks";
import type { ReviewerAssignment } from "@/features/reviews/types";

interface ReviewerAssignmentCardProps {
  assignment: ReviewerAssignment;
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The requested action could not be completed.";
}

export function ReviewerAssignmentCard({
  assignment,
}: ReviewerAssignmentCardProps) {
  const respondToInvitation = useRespondToReviewInvitation();
  const manuscriptDownload = useReviewerManuscriptDownload();

  const [showReport, setShowReport] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleInvitationResponse = (accept: boolean) => {
    setActionError(null);

    if (
      !accept &&
      !window.confirm(
        "Decline this invitation? You will not be able to review this manuscript.",
      )
    ) {
      return;
    }

    respondToInvitation.mutate(
      {
        assignmentId: assignment.id,
        accept,
      },
      {
        onError: (error) => setActionError(getErrorMessage(error)),
      },
    );
  };

  const handleDownload = () => {
    setActionError(null);

    manuscriptDownload.mutate(
      { assignmentId: assignment.id },
      {
        onSuccess: ({ manuscript_url }) => {
          const link = document.createElement("a");
          link.href = manuscript_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          link.remove();
        },
        onError: (error) => setActionError(getErrorMessage(error)),
      },
    );
  };

  const deadline =
    assignment.status === "PENDING"
      ? assignment.response_deadline
      : assignment.review_deadline;

  const isInvitationBusy = respondToInvitation.isPending;
  const deadlinePassed =
    assignment.is_overdue || isDeadlinePast(deadline);
  const hasRevisionResponse =
    Boolean(assignment.version.response_to_reviewers?.trim()) &&
    assignment.version.version_number > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle dir="auto">{assignment.submission.title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>{assignment.submission.section}</span>
          <ReviewRoundLabel versionNumber={assignment.version.version_number} />
          <span>{assignment.submission.language.toUpperCase()}</span>
        </CardDescription>
        <CardAction>
          <InvitationStatusBadge
            status={assignment.status}
            reviewSubmitted={assignment.review_submitted}
            isOverdue={deadlinePassed}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <DeadlineIndicator
            deadline={deadline}
            isOverdue={assignment.is_overdue}
            kind={assignment.status === "PENDING" ? "response" : "review"}
          />

          <div>
            <dt className="text-muted-foreground">Version submitted</dt>
            <dd className="mt-1">
              {formatDateTime(assignment.version.submitted_at)}
            </dd>
          </div>
        </dl>

        <details className="rounded-lg border bg-background p-3">
          <summary className="cursor-pointer font-medium">
            Manuscript abstract
          </summary>
          <p
            className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
            dir="auto"
          >
            {assignment.submission.abstract}
          </p>
        </details>

        {hasRevisionResponse && assignment.status === "ACCEPTED" ? (
          <details className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <summary className="cursor-pointer font-medium">
              Author response to previous reviews
            </summary>
            <p
              className="mt-3 whitespace-pre-wrap text-sm leading-6"
              dir="auto"
            >
              {assignment.version.response_to_reviewers}
            </p>
          </details>
        ) : null}

        {assignment.cancellation_reason ? (
          <Alert>
            <AlertTitle>Assignment closed</AlertTitle>
            <AlertDescription>
              {assignment.cancellation_reason}
            </AlertDescription>
          </Alert>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        {showReport && assignment.can_submit_review ? (
          <ReviewReportForm
            assignment={assignment}
            onCancel={() => setShowReport(false)}
            onSubmitted={() => setShowReport(false)}
          />
        ) : null}
      </CardContent>

      {assignment.status === "PENDING" && assignment.can_respond ? (
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={isInvitationBusy}
            onClick={() => handleInvitationResponse(false)}
          >
            Decline
          </Button>
          <Button
            type="button"
            disabled={isInvitationBusy}
            onClick={() => handleInvitationResponse(true)}
          >
            {isInvitationBusy ? "Saving…" : "Accept invitation"}
          </Button>
        </CardFooter>
      ) : null}

      {assignment.status === "ACCEPTED" && !assignment.review_submitted ? (
        <CardFooter className="flex-wrap justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Blinded reviewer access
          </p>

          <div className="flex flex-wrap gap-2">
            {assignment.can_download_manuscript ? (
              <Button
                type="button"
                variant="outline"
                disabled={manuscriptDownload.isPending}
                onClick={handleDownload}
              >
                <Download aria-hidden="true" />
                {manuscriptDownload.isPending
                  ? "Preparing…"
                  : "Download blinded manuscript"}
              </Button>
            ) : null}

            {assignment.can_submit_review ? (
              <Button
                type="button"
                onClick={() => setShowReport((current) => !current)}
              >
                <FileCheck2 aria-hidden="true" />
                {showReport ? "Close report" : "Write review"}
              </Button>
            ) : null}
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
