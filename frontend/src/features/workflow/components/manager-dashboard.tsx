"use client";

import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  RefreshCw,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ManuscriptSummary } from "@/features/editorial/components";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import {
  getManagerMonitoring,
  getManagerQueue,
} from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import { AttentionFlagBadge } from "@/features/workflow/components/attention-flag-badge";
import {
  getManagerQueueActionLabel,
  getManagerQueueStage,
  ManagerQueueStageBadge,
} from "@/features/workflow/components/manager-queue-stage";
import {
  type QueueTriageQueryState,
  useManagerQueueTriageStates,
} from "@/features/workflow/hooks";
import type {
  ManagerMonitoringSubmission,
  ManagerQueueSubmission,
} from "@/features/workflow/types";
import { cn } from "@/lib/utils";

const DASHBOARD_PAGE = 1;
const DASHBOARD_ITEM_LIMIT = 5;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatWaitingAge(value: string) {
  const submittedAt = new Date(value).getTime();

  if (!Number.isFinite(submittedAt)) {
    return "Submission date unavailable";
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - submittedAt) / (24 * 60 * 60 * 1000)),
  );

  if (days === 0) {
    return "Submitted today";
  }

  return `Waiting ${days} ${days === 1 ? "day" : "days"}`;
}

function hasOverdueWork(submission: ManagerMonitoringSubmission) {
  return (
    submission.attention_flags.includes("OVERDUE_REVIEWER_INVITATIONS") ||
    submission.attention_flags.includes("OVERDUE_REVIEWS")
  );
}

export function ManagerDashboard() {
  const queueQuery = useQuery({
    queryKey: managerQueryKeys.queue(DASHBOARD_PAGE),
    queryFn: () => getManagerQueue(DASHBOARD_PAGE),
  });

  const monitoringQuery = useQuery({
    queryKey: managerQueryKeys.monitoring(DASHBOARD_PAGE),
    queryFn: () => getManagerMonitoring(DASHBOARD_PAGE),
  });

  const queueSubmissions = queueQuery.data?.results ?? [];
  const triageQueries = useManagerQueueTriageStates(
    queueSubmissions.map((submission) => submission.id),
  );

  if (queueQuery.isLoading || monitoringQuery.isLoading) {
    return (
      <LoadingState
        label="Loading section management work"
        className="min-h-[50vh]"
      />
    );
  }

  if (queueQuery.isError || monitoringQuery.isError) {
    return (
      <ErrorState
        title="Could not load the Section Manager dashboard"
        description="The screening or active-manuscript queue could not be retrieved."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void queueQuery.refetch();
              void monitoringQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const queue = queueQuery.data;
  const monitoring = monitoringQuery.data;

  if (!queue || !monitoring) {
    return null;
  }

  const readyForAssignment = queue.results.filter((submission) => {
    const state = triageQueries.bySubmissionId.get(submission.id);
    return (
      !state?.isError &&
      getManagerQueueStage(state?.data) === "READY_FOR_ASSIGNMENT"
    );
  });

  const awaitingTriage = queue.results.filter(
    (submission) =>
      !readyForAssignment.some((ready) => ready.id === submission.id),
  );

  const flaggedCases = monitoring.results.filter(
    (submission) => submission.attention_flags.length > 0,
  );
  const attentionCases = [
    ...flaggedCases.filter(hasOverdueWork),
    ...flaggedCases.filter((submission) => !hasOverdueWork(submission)),
  ].slice(0, DASHBOARD_ITEM_LIMIT);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Section Manager"
        title="Editorial supervision"
        description="Triage new submissions, assign editorial responsibility, and intervene when active manuscripts need follow-up."
        actions={
          <>
            <Link
              href="/manager/submissions"
              className={buttonVariants({ size: "touch" })}
            >
              <ClipboardCheck aria-hidden="true" />
              Screening queue
            </Link>
            <Link
              href="/manager/monitoring"
              className={buttonVariants({
                variant: "outline",
                size: "touch",
              })}
            >
              <Activity aria-hidden="true" />
              Active manuscripts
            </Link>
          </>
        }
      />

      <section
        aria-label="Section workflow summary"
        className="grid overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs sm:grid-cols-3"
      >
        <SummaryItem
          label="Submitted queue"
          value={queue.count}
          description="Awaiting triage or editor assignment"
        />
        <SummaryItem
          label="Active manuscripts"
          value={monitoring.count}
          description="In the managed editorial workflow"
        />
        <SummaryItem
          label="Flagged on this page"
          value={flaggedCases.length}
          description="Overdue or waiting for follow-up"
        />
      </section>

      {queue.results.length > 0 && triageQueries.isPending ? (
        <LoadingState label="Checking triage progress" className="min-h-40" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ManagerActionQueue
            title="Awaiting initial triage"
            description="Start or continue the required screening assessment."
            submissions={awaitingTriage.slice(0, DASHBOARD_ITEM_LIMIT)}
            triageStates={triageQueries.bySubmissionId}
            emptyTitle="No triage assessments waiting"
            emptyDescription="Submitted manuscripts that still need screening will appear here."
          />

          <ManagerActionQueue
            title="Ready for editor assignment"
            description="Triage is complete and these manuscripts can move to editorial handling."
            submissions={readyForAssignment.slice(0, DASHBOARD_ITEM_LIMIT)}
            triageStates={triageQueries.bySubmissionId}
            emptyTitle="No manuscripts ready for assignment"
            emptyDescription="A manuscript appears here after triage is completed with a proceed outcome."
          />
        </div>
      )}

      <AttentionQueue submissions={attentionCases} />

      <p className="text-xs leading-5 text-muted-foreground">
        Dashboard action groups use the manuscripts loaded on the first queue
        page. Open the full queues to review all managed records.
      </p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="border-t border-border/80 p-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

function ManagerActionQueue({
  title,
  description,
  submissions,
  triageStates,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  submissions: ManagerQueueSubmission[];
  triageStates: Map<string, QueueTriageQueryState>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      <header className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {description}
          </p>
        </div>
        <Link
          href="/manager/submissions"
          className="shrink-0 rounded-sm text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          View all
        </Link>
      </header>

      {submissions.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <UserRoundCheck
            className="mx-auto size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-medium text-foreground">{emptyTitle}</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/80">
          {submissions.map((submission) => {
            const triageState = triageStates.get(submission.id);

            return (
              <article key={submission.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <ManuscriptSummary
                    title={submission.title}
                    metadata={
                      <>
                        {submission.section.name}
                        <span aria-hidden="true"> · </span>
                        {formatWaitingAge(submission.submitted_at)}
                      </>
                    }
                  />
                  <ManagerQueueStageBadge state={triageState} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Submitted {formatDate(submission.submitted_at)}
                  </span>
                  <Link
                    href={`/manager/submissions/${submission.id}`}
                    className={cn(
                      buttonVariants({
                        variant: "outline",
                        size: "touch",
                      }),
                      "sm:min-w-36",
                    )}
                  >
                    {getManagerQueueActionLabel(triageState)}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AttentionQueue({
  submissions,
}: {
  submissions: ManagerMonitoringSubmission[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      <header className="flex flex-col gap-3 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Stalled or attention-required manuscripts
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Overdue work is shown first, followed by other backend-reported
            attention conditions.
          </p>
        </div>
        <Link
          href="/manager/monitoring"
          className="shrink-0 rounded-sm text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Open monitoring
        </Link>
      </header>

      {submissions.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Activity
            className="mx-auto size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-medium text-foreground">
            No flagged cases on this page
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            The currently loaded monitoring records have no backend-reported
            attention conditions.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/80">
          {submissions.map((submission) => (
            <article
              key={submission.id}
              className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <ManuscriptSummary
                    title={submission.title}
                    metadata={
                      <>
                        {submission.section.name}
                        <span aria-hidden="true"> · </span>
                        {submission.assigned_editor?.full_name ??
                          "No editor assigned"}
                      </>
                    }
                  />
                  <SubmissionStatusBadge status={submission.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {submission.attention_flags.map((flag) => (
                    <AttentionFlagBadge key={flag} flag={flag} />
                  ))}
                </div>
              </div>

              <Link
                href="/manager/monitoring"
                className={buttonVariants({
                  variant: "outline",
                  size: "touch",
                })}
              >
                Review case
                <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
