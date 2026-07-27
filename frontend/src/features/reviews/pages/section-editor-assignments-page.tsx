"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DeadlineIndicator,
  isDeadlinePast,
  ResponsiveQueue,
  ReviewRoundLabel,
} from "@/features/editorial/components";
import {
  EditorQueueStageBadge,
  getEditorQueueStage,
  getEditorQueueStagePresentation,
  type EditorQueueStage,
} from "@/features/reviews/components";
import {
  useEditorQueueWorkspaces,
  useSectionEditorQueue,
} from "@/features/reviews/hooks";
import type {
  EditorReviewWorkspaceResponse,
  SectionEditorQueueSubmission,
} from "@/features/reviews/types";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { cn } from "@/lib/utils";

type QueueRecord = {
  submission: SectionEditorQueueSubmission;
  workspace?: EditorReviewWorkspaceResponse;
  stage?: EditorQueueStage;
  workspaceError: boolean;
  workspacePending: boolean;
};

const STAGE_ORDER: readonly EditorQueueStage[] = [
  "OVERDUE",
  "DECISION_REQUIRED",
  "REVIEWER_SELECTION",
  "REVIEWER_SHORTAGE",
  "REVISED_RETURNED",
  "WAITING_RESPONSES",
  "REVIEWS_IN_PROGRESS",
  "WAITING_AUTHOR",
  "REVIEW_SETUP",
];

const ACTION_STAGES = new Set<EditorQueueStage>([
  "OVERDUE",
  "DECISION_REQUIRED",
  "REVIEWER_SELECTION",
  "REVIEWER_SHORTAGE",
]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function waitingDays(value: string) {
  const submittedAt = new Date(value).getTime();

  if (!Number.isFinite(submittedAt)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - submittedAt) / (24 * 60 * 60 * 1000)),
  );
}

function reviewSummary(workspace?: EditorReviewWorkspaceResponse) {
  if (!workspace) {
    return "Review state unavailable";
  }

  return `${workspace.progress.submitted}/${workspace.required_reviews} required reviews submitted · ${workspace.progress.accepted} accepted · ${workspace.progress.pending} pending`;
}

function nearestActiveDeadline(workspace?: EditorReviewWorkspaceResponse) {
  const activeAssignments =
    workspace?.assignments
      .filter(
        (assignment) =>
          !assignment.review_submitted &&
          (assignment.status === "PENDING" ||
            assignment.status === "ACCEPTED"),
      )
      .map((assignment) => {
        const kind =
          assignment.status === "PENDING"
            ? ("response" as const)
            : ("review" as const);
        const deadline =
          kind === "response"
            ? assignment.response_deadline
            : assignment.review_deadline;

        return {
          deadline,
          isOverdue:
            assignment.is_overdue || isDeadlinePast(deadline),
          kind,
        };
      }) ?? [];

  return activeAssignments.sort(
    (left, right) =>
      new Date(left.deadline).getTime() -
      new Date(right.deadline).getTime(),
  )[0];
}

function matchesSearch(record: QueueRecord, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const { submission } = record;

  return (
    submission.title.toLocaleLowerCase().includes(normalizedSearch) ||
    submission.abstract.toLocaleLowerCase().includes(normalizedSearch) ||
    submission.section.name.toLocaleLowerCase().includes(normalizedSearch) ||
    submission.topic?.label?.toLocaleLowerCase().includes(normalizedSearch) ===
      true
  );
}

function QueueCard({ record }: { record: QueueRecord }) {
  const { submission, workspace, workspaceError, workspacePending } = record;
  const stage = record.stage;
  const presentation = stage
    ? getEditorQueueStagePresentation(stage)
    : undefined;
  const age = waitingDays(submission.submitted_at);
  const deadline = nearestActiveDeadline(workspace);

  return (
    <article className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SubmissionStatusBadge status={submission.status} />
          {stage ? <EditorQueueStageBadge stage={stage} /> : null}
          {workspace?.current_version ? (
            <ReviewRoundLabel
              versionNumber={workspace.current_version.version_number}
            />
          ) : null}
        </div>

        <h3 className="font-medium leading-6" dir="auto">
          {submission.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {submission.section.name} · Submitted{" "}
          <time dateTime={submission.submitted_at}>
            {formatDate(submission.submitted_at)}
          </time>
          {age === null ? "" : ` · ${age} day${age === 1 ? "" : "s"} waiting`}
        </p>
      </div>

      {workspacePending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Checking current review state…
        </p>
      ) : workspaceError ? (
        <p className="text-sm text-destructive">
          Current-round details could not be loaded.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {reviewSummary(workspace)}
          </p>
          {deadline ? (
            <DeadlineIndicator
              deadline={deadline.deadline}
              isOverdue={deadline.isOverdue}
              kind={deadline.kind}
            />
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-sm font-medium">
          {presentation?.actionLabel ?? "Open manuscript workspace"}
        </p>
        <Link
          href={`/section-editor/submissions/${submission.id}`}
          className={buttonVariants({ size: "sm" })}
        >
          Open
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function QueueTable({ records }: { records: QueueRecord[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
        <tr>
          <th className="px-4 py-3 font-medium">Manuscript</th>
          <th className="px-4 py-3 font-medium">Workflow</th>
          <th className="px-4 py-3 font-medium">Current round</th>
          <th className="px-4 py-3 text-right font-medium">Next action</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {records.map((record) => {
          const { submission, workspace } = record;
          const presentation = record.stage
            ? getEditorQueueStagePresentation(record.stage)
            : undefined;
          const age = waitingDays(submission.submitted_at);
          const deadline = nearestActiveDeadline(workspace);

          return (
            <tr key={submission.id} className="align-top">
              <td className="max-w-md px-4 py-4">
                <p className="font-medium leading-6" dir="auto">
                  {submission.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {submission.section.name} ·{" "}
                  {age === null
                    ? formatDate(submission.submitted_at)
                    : `${age} day${age === 1 ? "" : "s"} waiting`}
                </p>
              </td>
              <td className="px-4 py-4">
                <div className="flex max-w-64 flex-wrap gap-2">
                  <SubmissionStatusBadge status={submission.status} />
                  {record.stage ? (
                    <EditorQueueStageBadge stage={record.stage} />
                  ) : (
                    <Badge variant="outline">Checking workflow</Badge>
                  )}
                </div>
              </td>
              <td className="min-w-60 px-4 py-4">
                {workspace?.current_version ? (
                  <div className="space-y-2">
                    <ReviewRoundLabel
                      versionNumber={workspace.current_version.version_number}
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      {reviewSummary(workspace)}
                    </p>
                    {deadline ? (
                      <DeadlineIndicator
                        deadline={deadline.deadline}
                        isOverdue={deadline.isOverdue}
                        kind={deadline.kind}
                      />
                    ) : null}
                  </div>
                ) : record.workspaceError ? (
                  <span className="text-xs text-destructive">
                    Details unavailable
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Checking current round…
                  </span>
                )}
              </td>
              <td className="min-w-48 px-4 py-4 text-right">
                <p className="mb-2 text-xs text-muted-foreground">
                  {presentation?.actionLabel ?? "Inspect manuscript"}
                </p>
                <Link
                  href={`/section-editor/submissions/${submission.id}`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Open workspace
                  <ArrowRight aria-hidden="true" />
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SectionEditorAssignmentsPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<EditorQueueStage | "ALL">(
    "ALL",
  );
  const deferredSearch = useDeferredValue(searchTerm);

  const queueQuery = useSectionEditorQueue(page);
  const submissions = useMemo(
    () => queueQuery.data?.results ?? [],
    [queueQuery.data?.results],
  );
  const workspaceQueries = useEditorQueueWorkspaces(submissions);

  const records = useMemo<QueueRecord[]>(
    () =>
      submissions.map((submission) => {
        const workspaceState = workspaceQueries.states.get(submission.id);
        const workspace = workspaceState?.data;

        return {
          submission,
          workspace,
          stage: workspace
            ? getEditorQueueStage(submission, workspace)
            : undefined,
          workspaceError: workspaceState?.isError ?? false,
          workspacePending: workspaceState?.isPending ?? true,
        };
      }),
    [submissions, workspaceQueries.states],
  );

  const filteredRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          matchesSearch(record, deferredSearch) &&
          (stageFilter === "ALL" || record.stage === stageFilter),
      ),
    [deferredSearch, records, stageFilter],
  );

  const groupedRecords = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        stage,
        records: filteredRecords.filter((record) => record.stage === stage),
      })).filter((group) => group.records.length > 0),
    [filteredRecords],
  );

  const unresolvedRecords = filteredRecords.filter((record) => !record.stage);
  const actionCount = records.filter(
    (record) => record.stage && ACTION_STAGES.has(record.stage),
  ).length;
  const overdueCount = records.filter(
    (record) => record.stage === "OVERDUE",
  ).length;
  const decisionCount = records.filter(
    (record) => record.stage === "DECISION_REQUIRED",
  ).length;

  if (queueQuery.isPending) {
    return (
      <LoadingState
        label="Loading editorial assignments"
        className="min-h-[50vh]"
      />
    );
  }

  if (queueQuery.isError) {
    return (
      <ErrorState
        title="Editorial assignments unavailable"
        description={
          queueQuery.error instanceof Error
            ? queueQuery.error.message
            : "The assignment queue could not be loaded."
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              Promise.all([
                queueQuery.refetch(),
                workspaceQueries.refetch(),
              ])
            }
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Section Editor workspace"
        title="Peer-review assignments"
        description="Work from the next required editorial action while preserving the backend’s current manuscript status and review-round policy."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={queueQuery.isFetching || workspaceQueries.isFetching}
            onClick={() => queueQuery.refetch()}
          >
            <RefreshCw
              className={cn(
                (queueQuery.isFetching || workspaceQueries.isFetching) &&
                  "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />

      <section
        aria-label="Current page editorial summary"
        className="grid divide-y rounded-xl border bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
      >
        {[
          ["Assignments · all pages", queueQuery.data?.count ?? records.length],
          ["Action · this page", actionCount],
          ["Overdue · this page", overdueCount],
          ["Decision ready · this page", decisionCount],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <Notice
        title="Queue scope"
        description="Workflow categories are derived from the review workspace for assignments on this page. No separate Editor pre-review checklist or weighted priority feed is exposed, so neither is recreated on the client."
        tone="info"
      />

      {submissions.length === 0 ? (
        <EmptyState
          title="No active editorial assignments"
          description="Manuscripts assigned to you by a Section Manager will appear here. Finalized submissions are excluded by the Editor queue contract."
        />
      ) : (
        <>
          <section
            aria-label="Queue filters"
            className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.35fr)]"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchTerm}
                className="pl-9"
                aria-label="Search assignments on this page"
                placeholder="Search title, section, abstract, or topic"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <label className="grid gap-1 text-xs text-muted-foreground">
              Required next action
              <select
                value={stageFilter}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) =>
                  setStageFilter(event.target.value as EditorQueueStage | "ALL")
                }
              >
                <option value="ALL">All workflow stages</option>
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>
                    {getEditorQueueStagePresentation(stage).label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {filteredRecords.length === 0 ? (
            <EmptyState
              title="No assignments match these filters"
              description="Adjust the search term or required-next-action filter."
            />
          ) : (
            <div className="space-y-7">
              {groupedRecords.map(({ stage, records: stageRecords }) => {
                const presentation = getEditorQueueStagePresentation(stage);

                return (
                  <section
                    key={stage}
                    aria-labelledby={`editor-queue-${stage}`}
                    className="overflow-hidden rounded-xl border bg-card"
                  >
                    <header className="border-b px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          id={`editor-queue-${stage}`}
                          className="font-semibold"
                        >
                          {presentation.label}
                        </h2>
                        <Badge variant="outline">{stageRecords.length}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {presentation.description}
                      </p>
                    </header>

                    <ResponsiveQueue
                      cards={stageRecords.map((record) => (
                        <QueueCard
                          key={record.submission.id}
                          record={record}
                        />
                      ))}
                      table={<QueueTable records={stageRecords} />}
                    />
                  </section>
                );
              })}

              {unresolvedRecords.length > 0 ? (
                <section
                  aria-labelledby="editor-queue-checking"
                  className="overflow-hidden rounded-xl border bg-card"
                >
                  <header className="border-b px-4 py-4">
                    <h2 id="editor-queue-checking" className="font-semibold">
                      Checking current workflow
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      These assignments remain accessible while current-round
                      details load or recover.
                    </p>
                  </header>
                  <ResponsiveQueue
                    cards={unresolvedRecords.map((record) => (
                      <QueueCard
                        key={record.submission.id}
                        record={record}
                      />
                    ))}
                    table={<QueueTable records={unresolvedRecords} />}
                  />
                </section>
              ) : null}
            </div>
          )}

          <nav
            aria-label="Editorial assignment pagination"
            className="flex items-center justify-between gap-3"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!queueQuery.data?.previous}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft aria-hidden="true" />
              Previous
            </Button>

            <span className="text-sm text-muted-foreground">Page {page}</span>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!queueQuery.data?.next}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
