"use client";

import * as React from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { EditorReassignmentDialog } from "@/features/workflow/components/assignment/editor-reassignment-dialog";
import { AttentionFlagBadge } from "@/features/workflow/components/attention-flag-badge";
import { ReviewProgress } from "@/features/workflow/components/review-progress";
import { getManagerMonitoring } from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import type {
  ManagerMonitoringStatus,
  ManagerMonitoringSubmission,
} from "@/features/workflow/types";

type MonitoringFilter = ManagerMonitoringStatus | "ALL";

const EMPTY_MONITORING: ManagerMonitoringSubmission[] = [];

const statusOptions: Array<{
  value: MonitoringFilter;
  label: string;
}> = [
  { value: "ALL", label: "All active statuses" },
  { value: "ASSIGNED", label: "Assigned to editor" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "REVIEWED", label: "Reviews completed" },
  { value: "UNDER_REVISION", label: "Revision requested" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatRevisionRounds(count: number) {
  if (count === 0) {
    return "Initial submission";
  }

  return `${count} revision ${count === 1 ? "round" : "rounds"}`;
}

export function ManagerMonitoringPage() {
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] =
    React.useState<MonitoringFilter>("ALL");
  const [reassignmentTarget, setReassignmentTarget] =
    React.useState<ManagerMonitoringSubmission | null>(null);

  const apiStatus = statusFilter === "ALL" ? undefined : statusFilter;

  const monitoringQuery = useQuery({
    queryKey: managerQueryKeys.monitoring(page, apiStatus),
    queryFn: () => getManagerMonitoring(page, apiStatus),
  });

  const submissions = monitoringQuery.data?.results ?? EMPTY_MONITORING;

  const hasPreviousPage = Boolean(monitoringQuery.data?.previous);
  const hasNextPage = Boolean(monitoringQuery.data?.next);

  function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(event.target.value as MonitoringFilter);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          Editorial monitoring
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Active manuscripts
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Monitor Section Editor assignments, reviewer invitations, submitted
          reviews, revision rounds, overdue work, and cases awaiting action.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="max-w-sm">
          <label
            htmlFor="monitoring-status-filter"
            className="block text-sm font-medium text-slate-700"
          >
            Workflow status
          </label>

          <div className="relative mt-2">
            <Filter
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />

            <select
              id="monitoring-status-filter"
              value={statusFilter}
              onChange={handleStatusChange}
              className="block h-10 w-full appearance-none rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronRight
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-slate-400"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Managed cases
              </h2>

              <p className="mt-1 text-sm text-slate-500" aria-live="polite">
                {monitoringQuery.data
                  ? `${monitoringQuery.data.count} manuscript${
                      monitoringQuery.data.count === 1 ? "" : "s"
                    } matching this status filter`
                  : "Loading active manuscripts..."}
              </p>
            </div>

            {monitoringQuery.data && submissions.length > 0 ? (
              <p className="text-sm text-slate-500">Page {page}</p>
            ) : null}
          </div>
        </div>

        {monitoringQuery.isLoading ? (
          <MonitoringSkeleton />
        ) : monitoringQuery.isError ? (
          <MonitoringError
            onRetry={() => {
              void monitoringQuery.refetch();
            }}
          />
        ) : submissions.length === 0 ? (
          <EmptyMonitoringState filtered={statusFilter !== "ALL"} />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <MonitoringTable
                submissions={submissions}
                onReassign={setReassignmentTarget}
              />
            </div>

            <div className="divide-y divide-slate-200 xl:hidden">
              {submissions.map((submission) => (
                <MonitoringMobileCard
                  key={submission.id}
                  submission={submission}
                  onReassign={setReassignmentTarget}
                />
              ))}
            </div>
          </>
        )}

        {monitoringQuery.data && submissions.length > 0 ? (
          <nav
            aria-label="Active manuscript pagination"
            className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4"
          >
            <p className="text-sm text-slate-500">Page {page}</p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!hasPreviousPage || monitoringQuery.isFetching}
                onClick={() =>
                  setPage((currentPage) => Math.max(1, currentPage - 1))
                }
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!hasNextPage || monitoringQuery.isFetching}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </section>

      {reassignmentTarget?.assigned_editor ? (
        <EditorReassignmentDialog
          open
          submissionId={reassignmentTarget.id}
          submissionTitle={reassignmentTarget.title}
          currentEditor={reassignmentTarget.assigned_editor}
          onOpenChange={(open) => {
            if (!open) {
              setReassignmentTarget(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function MonitoringTable({
  submissions,
  onReassign,
}: {
  submissions: ManagerMonitoringSubmission[];
  onReassign: (submission: ManagerMonitoringSubmission) => void;
}) {
  return (
    <table className="min-w-full divide-y divide-slate-200">
      <caption className="sr-only">
        Active manuscripts and editorial review progress
      </caption>

      <thead className="bg-slate-50">
        <tr>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Manuscript
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Status
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Section Editor
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Version
          </th>
          <th
            scope="col"
            className="min-w-80 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Review progress
          </th>
          <th
            scope="col"
            className="min-w-60 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Attention
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Action
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-200 bg-white">
        {submissions.map((submission) => (
          <tr key={submission.id} className="hover:bg-slate-50">
            <td className="max-w-sm px-5 py-4 align-top">
              <h3 className="line-clamp-2 font-medium text-slate-950">
                {submission.title}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {submission.section.name}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Submitted {formatDate(submission.submitted_at)}
              </p>
            </td>

            <td className="px-5 py-4 align-top">
              <SubmissionStatusBadge status={submission.status} />
            </td>

            <td className="px-5 py-4 align-top">
              {submission.assigned_editor ? (
                <>
                  <p className="text-sm font-medium text-slate-900">
                    {submission.assigned_editor.full_name}
                  </p>
                  <p className="mt-1 max-w-48 text-xs text-slate-500">
                    {submission.assigned_editor.affiliation ||
                      "No affiliation provided"}
                  </p>
                </>
              ) : (
                <span className="text-sm text-amber-700">
                  No editor assigned
                </span>
              )}
            </td>

            <td className="px-5 py-4 align-top">
              <p className="text-sm font-medium text-slate-900">
                {submission.latest_version_number === null
                  ? "No version"
                  : `Version ${submission.latest_version_number}`}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {formatRevisionRounds(submission.revision_round_count)}
              </p>
            </td>

            <td className="px-5 py-4 align-top">
              <ReviewProgress progress={submission.review_progress} />
            </td>

            <td className="px-5 py-4 align-top">
              {submission.attention_flags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {submission.attention_flags.map((flag) => (
                    <AttentionFlagBadge key={flag} flag={flag} />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-500">No active flags</span>
              )}
            </td>

            <td className="px-5 py-4 text-right align-top">
              <Button
                type="button"
                variant="outline"
                disabled={!submission.assigned_editor}
                onClick={() => onReassign(submission)}
              >
                Reassign
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonitoringMobileCard({
  submission,
  onReassign,
}: {
  submission: ManagerMonitoringSubmission;
  onReassign: (submission: ManagerMonitoringSubmission) => void;
}) {
  return (
    <article className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-medium leading-6 text-slate-950">
            {submission.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {submission.section.name}
          </p>
        </div>

        <SubmissionStatusBadge status={submission.status} />
      </div>

      <dl className="mt-4 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Section Editor
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {submission.assigned_editor?.full_name ?? "No editor assigned"}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Submitted
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {formatDate(submission.submitted_at)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Current version
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {submission.latest_version_number === null
              ? "No version"
              : `Version ${submission.latest_version_number}`}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Revision history
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {formatRevisionRounds(submission.revision_round_count)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Review progress
        </h3>
        <div className="mt-3">
          <ReviewProgress progress={submission.review_progress} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-900">Attention</h3>

        {submission.attention_flags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {submission.attention_flags.map((flag) => (
              <AttentionFlagBadge key={flag} flag={flag} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No active attention flags.
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={!submission.assigned_editor}
        onClick={() => onReassign(submission)}
        className="mt-5 w-full"
      >
        Reassign Section Editor
      </Button>
    </article>
  );
}

function MonitoringError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-6">
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-5"
      >
        <div className="flex items-start gap-3">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-red-700"
          />

          <div>
            <h3 className="font-semibold text-red-900">
              Could not load active manuscripts
            </h3>
            <p className="mt-1 text-sm leading-6 text-red-700">
              Check your connection and try loading the monitoring queue again.
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="mt-4 border-red-300 bg-white text-red-800 hover:bg-red-100"
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMonitoringState({ filtered }: { filtered: boolean }) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
        <Activity
          aria-hidden="true"
          className="mx-auto size-8 text-slate-400"
        />

        <h3 className="mt-4 text-base font-semibold text-slate-950">
          {filtered
            ? "No manuscripts match this status"
            : "No active manuscripts"}
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {filtered
            ? "Choose another workflow status to view different managed cases."
            : "Manuscripts will appear here after triage and Section Editor assignment."}
        </p>
      </div>
    </div>
  );
}

function MonitoringSkeleton() {
  return (
    <div
      aria-label="Loading active manuscripts"
      aria-busy="true"
      className="divide-y divide-slate-200"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 h-24 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
