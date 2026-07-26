"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewerAssignmentCard } from "@/features/reviews/components";
import { useReviewerAssignments } from "@/features/reviews/hooks";
import type { ReviewerAssignment } from "@/features/reviews/types";

function compareDeadlines(
  first: ReviewerAssignment,
  second: ReviewerAssignment,
) {
  const firstDeadline = first.review_deadline ?? first.response_deadline;
  const secondDeadline = second.review_deadline ?? second.response_deadline;

  return (
    new Date(firstDeadline ?? 0).getTime() -
    new Date(secondDeadline ?? 0).getTime()
  );
}

interface AssignmentSectionProps {
  title: string;
  description: string;
  assignments: ReviewerAssignment[];
  emptyMessage: string;
}

function AssignmentSection({
  title,
  description,
  assignments,
  emptyMessage,
}: AssignmentSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {assignments.length > 0 ? (
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <ReviewerAssignmentCard
              key={assignment.id}
              assignment={assignment}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyMessage} className="min-h-32" />
      )}
    </section>
  );
}

export function ReviewerInvitationsPage() {
  const assignmentsQuery = useReviewerAssignments();
  const assignments = useMemo(
    () => assignmentsQuery.data ?? [],
    [assignmentsQuery.data],
  );

  const groupedAssignments = useMemo(() => {
    const invitations = assignments
      .filter((assignment) => assignment.status === "PENDING")
      .sort(compareDeadlines);

    const active = assignments
      .filter(
        (assignment) =>
          assignment.status === "ACCEPTED" && !assignment.review_submitted,
      )
      .sort((first, second) => {
        if (first.is_overdue !== second.is_overdue) {
          return first.is_overdue ? -1 : 1;
        }

        return compareDeadlines(first, second);
      });

    const history = assignments
      .filter(
        (assignment) =>
          assignment.review_submitted ||
          ["DECLINED", "EXPIRED", "CANCELLED"].includes(assignment.status),
      )
      .sort(
        (first, second) =>
          new Date(second.assigned_at).getTime() -
          new Date(first.assigned_at).getTime(),
      );

    return { invitations, active, history };
  }, [assignments]);

  if (assignmentsQuery.isPending) {
    return (
      <section className="space-y-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </section>
    );
  }

  if (assignmentsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Reviewer workspace unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {assignmentsQuery.error instanceof Error
              ? assignmentsQuery.error.message
              : "Assignments could not be loaded."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => assignmentsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reviewer workspace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage invitations, access blinded manuscripts, and submit
          confidential peer-review reports.
        </p>
      </header>

      <section
        aria-label="Reviewer assignment summary"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Pending invitations</p>
            <p className="mt-2 text-2xl font-semibold">
              {groupedAssignments.invitations.length}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Active reviews</p>
            <p className="mt-2 text-2xl font-semibold">
              {groupedAssignments.active.length}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Submitted or closed</p>
            <p className="mt-2 text-2xl font-semibold">
              {groupedAssignments.history.length}
            </p>
          </CardContent>
        </Card>
      </section>

      {assignments.length === 0 ? (
        <EmptyState
          title="No reviewer assignments"
          description="New review invitations and active assignments will appear here."
        />
      ) : (
        <>
          <AssignmentSection
            title="Pending invitations"
            description="Accept or decline invitations before their response deadlines."
            assignments={groupedAssignments.invitations}
            emptyMessage="No pending invitations"
          />

          <AssignmentSection
            title="Active reviews"
            description="Download the blinded manuscript and submit your report before the deadline."
            assignments={groupedAssignments.active}
            emptyMessage="No active reviews"
          />

          <AssignmentSection
            title="Review history"
            description="Submitted reviews and closed invitations remain available for workflow tracking."
            assignments={groupedAssignments.history}
            emptyMessage="No review history"
          />
        </>
      )}
    </div>
  );
}
