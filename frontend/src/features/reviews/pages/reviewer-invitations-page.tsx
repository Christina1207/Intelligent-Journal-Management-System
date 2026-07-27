"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewerAssignmentCard } from "@/features/reviews/components";
import { useReviewerAssignments } from "@/features/reviews/hooks";
import {
  compareAssignmentDeadlines,
  compareNewestAssignments,
  getReviewerQueueGroup,
  type ReviewerQueueGroup,
} from "@/features/reviews/reviewer-assignment-state";
import type { ReviewerAssignment } from "@/features/reviews/types";

interface AssignmentSectionProps {
  title: string;
  description: string;
  assignments: ReviewerAssignment[];
  variant?: "invitation" | "queue" | "history";
  icon: typeof Clock3;
  emptyMessage?: string;
  showWhenEmpty?: boolean;
}

function AssignmentSection({
  title,
  description,
  assignments,
  variant = "queue",
  icon: Icon,
  emptyMessage,
  showWhenEmpty = false,
}: AssignmentSectionProps) {
  if (assignments.length === 0 && !showWhenEmpty) {
    return null;
  }

  const headingId = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-heading`;

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {assignments.length > 0 ? (
        <div className="grid gap-3">
          {assignments.map((assignment) => (
            <ReviewerAssignmentCard
              key={assignment.id}
              assignment={assignment}
              variant={variant}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={emptyMessage ?? `No ${title.toLowerCase()}`}
          className="min-h-28"
        />
      )}
    </section>
  );
}

function createAssignmentGroups(): Record<
  ReviewerQueueGroup,
  ReviewerAssignment[]
> {
  return {
    INVITATION: [],
    APPROACHING: [],
    OVERDUE: [],
    MANDATORY_REVISION: [],
    ACTIVE: [],
    COMPLETED: [],
    CLOSED: [],
  };
}

export function ReviewerInvitationsPage() {
  const assignmentsQuery = useReviewerAssignments();
  const assignments = useMemo(
    () => assignmentsQuery.data ?? [],
    [assignmentsQuery.data],
  );

  const groupedAssignments = useMemo(() => {
    const groups = createAssignmentGroups();

    for (const assignment of assignments) {
      groups[getReviewerQueueGroup(assignment)].push(assignment);
    }

    for (const group of [
      "INVITATION",
      "APPROACHING",
      "OVERDUE",
      "MANDATORY_REVISION",
      "ACTIVE",
    ] satisfies ReviewerQueueGroup[]) {
      groups[group].sort(compareAssignmentDeadlines);
    }

    groups.COMPLETED.sort(compareNewestAssignments);
    groups.CLOSED.sort(compareNewestAssignments);

    return groups;
  }, [assignments]);

  if (assignmentsQuery.isPending) {
    return (
      <LoadingState
        label="Loading reviewer assignments"
        className="min-h-[50vh]"
      />
    );
  }

  if (assignmentsQuery.isError) {
    return (
      <ErrorState
        title="Reviewer workspace unavailable"
        description={
          assignmentsQuery.error instanceof Error
            ? assignmentsQuery.error.message
            : "Assignments could not be loaded."
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => assignmentsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const activeCount =
    groupedAssignments.APPROACHING.length +
    groupedAssignments.OVERDUE.length +
    groupedAssignments.MANDATORY_REVISION.length +
    groupedAssignments.ACTIVE.length;

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Peer review"
        title="Reviewer workspace"
        description="Respond to invitations, work from blinded manuscript versions, and submit advisory reports without exposing author identities."
        actions={
          assignmentsQuery.isFetching ? (
            <p
              className="flex items-center gap-2 text-xs text-muted-foreground"
              role="status"
            >
              <RefreshCw
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Refreshing assignments
            </p>
          ) : null
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          title="No reviewer assignments"
          description="New review invitations and active assignments will appear here."
          icon={<ClipboardList aria-hidden="true" />}
        />
      ) : (
        <>
          <AssignmentSection
            title="Invitations requiring response"
            description="Check scope, availability, conflicts, and both deadlines before responding."
            assignments={groupedAssignments.INVITATION}
            variant="invitation"
            icon={Send}
          />

          <AssignmentSection
            title="Reviews due soon"
            description="Active first-round reviews with a deadline in the next 48 hours."
            assignments={groupedAssignments.APPROACHING}
            icon={Clock3}
          />

          <AssignmentSection
            title="Overdue reviews"
            description="These accepted reviews have passed their deadlines and need immediate attention."
            assignments={groupedAssignments.OVERDUE}
            icon={TriangleAlert}
          />

          <AssignmentSection
            title="Mandatory revision-round reviews"
            description="Accepted reviewers continue automatically on revised manuscript versions; no optional invitation is shown."
            assignments={groupedAssignments.MANDATORY_REVISION}
            icon={RotateCcw}
          />

          <AssignmentSection
            title="Other active reviews"
            description="Accepted reviews that are underway and not yet close to their deadlines."
            assignments={groupedAssignments.ACTIVE}
            icon={ClipboardList}
          />

          <AssignmentSection
            title="Recently completed reviews"
            description="Submitted review assignments are locked and retained as read-only workflow records."
            assignments={groupedAssignments.COMPLETED}
            variant="history"
            icon={CheckCircle2}
          />

          <section
            aria-labelledby="reviewer-workload-heading"
            className="space-y-3"
          >
            <div>
              <h2 id="reviewer-workload-heading" className="text-lg font-semibold">
                Workload summary
              </h2>
              <p className="text-sm text-muted-foreground">
                A concise count of your current reviewer workload.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Awaiting response",
                  value: groupedAssignments.INVITATION.length,
                },
                { label: "Active reviews", value: activeCount },
                {
                  label: "Overdue",
                  value: groupedAssignments.OVERDUE.length,
                },
                {
                  label: "Completed",
                  value: groupedAssignments.COMPLETED.length,
                },
              ].map((item) => (
                <Card key={item.label} size="sm">
                  <CardContent className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-semibold">{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {groupedAssignments.CLOSED.length > 0 ? (
            <details className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <summary className="cursor-pointer font-medium">
                Closed invitations ({groupedAssignments.CLOSED.length})
              </summary>
              <div className="mt-4 grid gap-3">
                {groupedAssignments.CLOSED.map((assignment) => (
                  <ReviewerAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    variant="history"
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
