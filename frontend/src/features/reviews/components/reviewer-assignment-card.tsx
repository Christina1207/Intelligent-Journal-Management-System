"use client";

import { useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DeadlineIndicator,
  InvitationStatusBadge,
  isDeadlinePast,
  ReviewRoundLabel,
} from "@/features/editorial/components";
import { useRespondToReviewInvitation } from "@/features/reviews/hooks";
import {
  isActiveReviewOverdue,
  isMandatoryRevisionAssignment,
} from "@/features/reviews/reviewer-assignment-state";
import type { ReviewerAssignment } from "@/features/reviews/types";

type ReviewerAssignmentCardVariant = "invitation" | "queue" | "history";

interface ReviewerAssignmentCardProps {
  assignment: ReviewerAssignment;
  variant?: ReviewerAssignmentCardVariant;
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
    : "The invitation response could not be saved.";
}

function AssignmentMetadata({
  assignment,
  includeResponseDeadline = false,
  showDeadlineState = true,
}: {
  assignment: ReviewerAssignment;
  includeResponseDeadline?: boolean;
  showDeadlineState?: boolean;
}) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {includeResponseDeadline ? (
        <DeadlineIndicator
          deadline={assignment.response_deadline}
          kind="response"
        />
      ) : null}
      {showDeadlineState ? (
        <DeadlineIndicator
          deadline={assignment.review_deadline}
          isOverdue={isActiveReviewOverdue(assignment)}
          kind="review"
        />
      ) : (
        <div>
          <dt className="text-xs text-muted-foreground">Review deadline</dt>
          <dd className="mt-1">
            <time dateTime={assignment.review_deadline}>
              {formatDateTime(assignment.review_deadline)}
            </time>
          </dd>
        </div>
      )}
      <div>
        <dt className="text-xs text-muted-foreground">Invitation sent</dt>
        <dd className="mt-1">
          <time dateTime={assignment.assigned_at}>
            {formatDateTime(assignment.assigned_at)}
          </time>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Version submitted</dt>
        <dd className="mt-1">
          <time dateTime={assignment.version.submitted_at}>
            {formatDateTime(assignment.version.submitted_at)}
          </time>
        </dd>
      </div>
    </dl>
  );
}

export function ReviewerAssignmentCard({
  assignment,
  variant = "queue",
}: ReviewerAssignmentCardProps) {
  const respondToInvitation = useRespondToReviewInvitation();
  const [confirmation, setConfirmation] = useState<
    "accept" | "decline" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isInvitation = variant === "invitation";
  const isCompleted = assignment.review_submitted;
  const isMandatoryRevision = isMandatoryRevisionAssignment(assignment);
  const isOverdue = isActiveReviewOverdue(assignment);
  const invitationExpired =
    assignment.status === "PENDING" &&
    (!assignment.can_respond ||
      isDeadlinePast(assignment.response_deadline));

  const confirmInvitationResponse = async () => {
    if (!confirmation) {
      return;
    }

    setActionError(null);

    try {
      await respondToInvitation.mutateAsync({
        assignmentId: assignment.id,
        accept: confirmation === "accept",
      });
      setConfirmation(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <>
      <Card
        size={variant === "queue" || variant === "history" ? "sm" : "default"}
        className={
          isOverdue
            ? "border-status-danger-border"
            : isMandatoryRevision
              ? "border-primary/30"
              : undefined
        }
      >
        <CardHeader>
          <CardTitle dir="auto">{assignment.submission.title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{assignment.submission.section}</span>
            <ReviewRoundLabel
              versionNumber={assignment.version.version_number}
            />
            <span>{assignment.submission.language.toUpperCase()}</span>
          </CardDescription>
          <CardAction>
            <InvitationStatusBadge
              status={assignment.status}
              reviewSubmitted={isCompleted}
              isOverdue={
                isOverdue ||
                (assignment.status === "PENDING" &&
                  isDeadlinePast(assignment.response_deadline))
              }
            />
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <AssignmentMetadata
            assignment={assignment}
            includeResponseDeadline={isInvitation}
            showDeadlineState={variant !== "history"}
          />

          {isInvitation ? (
            <>
              <details className="rounded-lg border bg-background p-3">
                <summary className="cursor-pointer font-medium">
                  Read the blinded manuscript abstract
                </summary>
                <p
                  className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
                  dir="auto"
                >
                  {assignment.submission.abstract}
                </p>
              </details>

              <Alert variant="info">
                <ShieldAlert aria-hidden="true" />
                <AlertTitle>Check for conflicts before responding</AlertTitle>
                <AlertDescription>
                  Decline if the topic, institution, recent collaboration, or
                  another relationship could affect your impartiality. The
                  current API does not collect a decline reason.
                </AlertDescription>
              </Alert>
            </>
          ) : null}

          {isMandatoryRevision ? (
            <Alert variant="info">
              <RotateCcw aria-hidden="true" />
              <AlertTitle>Mandatory revision-round review</AlertTitle>
              <AlertDescription>
                This assignment continues your accepted review into version{" "}
                {assignment.version.version_number}. A new invitation response
                is not required.
              </AlertDescription>
            </Alert>
          ) : null}

          {invitationExpired ? (
            <Alert variant="warning">
              <Clock3 aria-hidden="true" />
              <AlertTitle>Response no longer available</AlertTitle>
              <AlertDescription>
                The response deadline has passed or the invitation was closed.
                Refresh the workspace if its status has not updated yet.
              </AlertDescription>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Response not saved</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>

        {isInvitation &&
        assignment.status === "PENDING" &&
        assignment.can_respond &&
        !invitationExpired ? (
          <CardFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-full sm:w-auto"
              disabled={respondToInvitation.isPending}
              onClick={() => {
                setActionError(null);
                setConfirmation("decline");
              }}
            >
              Decline
            </Button>
            <Button
              type="button"
              size="touch"
              className="w-full sm:w-auto"
              disabled={respondToInvitation.isPending}
              onClick={() => {
                setActionError(null);
                setConfirmation("accept");
              }}
            >
              Accept invitation
            </Button>
          </CardFooter>
        ) : variant !== "invitation" ? (
          <CardFooter className="justify-end">
            <Link
              href={`/reviewer/assignments/${assignment.id}`}
              className={buttonVariants({
                variant: isOverdue ? "default" : "outline",
                size: "sm",
              })}
            >
              {isCompleted
                ? "View review record"
                : assignment.status === "ACCEPTED"
                  ? "Open review workspace"
                  : "View assignment"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </CardFooter>
        ) : null}
      </Card>

      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !respondToInvitation.isPending) {
            setConfirmation(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {confirmation === "accept"
                ? "Accept this review invitation?"
                : "Decline this review invitation?"}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "accept"
                ? "Accepting makes the blinded manuscript available and commits you to the stated review deadline."
                : "Declining closes this invitation. The current workflow does not request or store a decline reason."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/35 p-3">
            <p className="font-medium" dir="auto">
              {assignment.submission.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review due {formatDateTime(assignment.review_deadline)}
            </p>
          </div>

          {confirmation === "accept" ? (
            <Alert variant="warning">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Confirm your availability</AlertTitle>
              <AlertDescription>
                Accept only if you can complete an impartial review by the
                deadline. You will receive access to the blinded version only.
              </AlertDescription>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert variant="destructive">
              <AlertTitle>Response not saved</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={respondToInvitation.isPending}
                />
              }
            >
              Go back
            </DialogClose>
            <Button
              type="button"
              variant={
                confirmation === "decline" ? "destructive" : "default"
              }
              disabled={respondToInvitation.isPending}
              onClick={confirmInvitationResponse}
            >
              {respondToInvitation.isPending
                ? "Saving response…"
                : confirmation === "accept"
                  ? "Confirm acceptance"
                  : "Confirm decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
