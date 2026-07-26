"use client";

import * as React from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ManuscriptSummary,
  ResponsiveQueue,
} from "@/features/editorial/components";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { getManagerMonitoring } from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import { EditorReassignmentDialog } from "@/features/workflow/components/assignment/editor-reassignment-dialog";
import { AttentionFlagBadge } from "@/features/workflow/components/attention-flag-badge";
import { ReviewProgress } from "@/features/workflow/components/review-progress";
import type {
  ManagerAttentionFlag,
  ManagerMonitoringStatus,
  ManagerMonitoringSubmission,
} from "@/features/workflow/types";

type MonitoringStatusFilter = ManagerMonitoringStatus | "ALL";
type AttentionFilter =
  | "ALL"
  | "NEEDS_ATTENTION"
  | "OVERDUE"
  | "REVIEWER_SETUP"
  | "DECISION_PENDING"
  | "REVISION_PENDING";

const EMPTY_MONITORING: ManagerMonitoringSubmission[] = [];

const statusOptions: Array<{
  value: MonitoringStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All active statuses" },
  { value: "ASSIGNED", label: "Assigned to editor" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "REVIEWED", label: "Decision pending" },
  { value: "UNDER_REVISION", label: "Revision requested" },
];

const attentionOptions: Array<{
  value: AttentionFilter;
  label: string;
}> = [
  { value: "ALL", label: "All attention states" },
  { value: "NEEDS_ATTENTION", label: "Any flagged condition" },
  { value: "OVERDUE", label: "Overdue invitation or review" },
  { value: "REVIEWER_SETUP", label: "Reviewer invitations not started" },
  { value: "DECISION_PENDING", label: "Editor decision pending" },
  { value: "REVISION_PENDING", label: "Author revision pending" },
];

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
    return "Waiting time unavailable";
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - submittedAt) / (24 * 60 * 60 * 1000)),
  );

  return days === 0
    ? "Submitted today"
    : `${days} ${days === 1 ? "day" : "days"} since submission`;
}

function formatRevisionRounds(count: number) {
  if (count === 0) {
    return "Initial submission";
  }

  return `${count} revision ${count === 1 ? "round" : "rounds"}`;
}

function hasFlag(
  submission: ManagerMonitoringSubmission,
  ...flags: ManagerAttentionFlag[]
) {
  return flags.some((flag) => submission.attention_flags.includes(flag));
}

function hasOverdueWork(submission: ManagerMonitoringSubmission) {
  return hasFlag(
    submission,
    "OVERDUE_REVIEWER_INVITATIONS",
    "OVERDUE_REVIEWS",
  );
}

function matchesAttentionFilter(
  submission: ManagerMonitoringSubmission,
  filter: AttentionFilter,
) {
  switch (filter) {
    case "NEEDS_ATTENTION":
      return submission.attention_flags.length > 0;
    case "OVERDUE":
      return hasOverdueWork(submission);
    case "REVIEWER_SETUP":
      return hasFlag(submission, "REVIEWER_INVITATIONS_NOT_STARTED");
    case "DECISION_PENDING":
      return hasFlag(submission, "EDITOR_DECISION_PENDING");
    case "REVISION_PENDING":
      return hasFlag(submission, "AUTHOR_REVISION_PENDING");
    default:
      return true;
  }
}

function matchesSearch(
  submission: ManagerMonitoringSubmission,
  searchTerm: string,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return (
    submission.title.toLowerCase().includes(normalizedSearch) ||
    submission.section.name.toLowerCase().includes(normalizedSearch) ||
    submission.assigned_editor?.full_name
      .toLowerCase()
      .includes(normalizedSearch) === true
  );
}

function attentionWeight(submission: ManagerMonitoringSubmission) {
  if (hasOverdueWork(submission)) {
    return 2;
  }

  return submission.attention_flags.length > 0 ? 1 : 0;
}

export function ManagerMonitoringPage() {
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] =
    React.useState<MonitoringStatusFilter>("ALL");
  const [attentionFilter, setAttentionFilter] =
    React.useState<AttentionFilter>("ALL");
  const [editorFilter, setEditorFilter] = React.useState("ALL");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [reassignmentTarget, setReassignmentTarget] =
    React.useState<ManagerMonitoringSubmission | null>(null);

  const apiStatus = statusFilter === "ALL" ? undefined : statusFilter;

  const monitoringQuery = useQuery({
    queryKey: managerQueryKeys.monitoring(page, apiStatus),
    queryFn: () => getManagerMonitoring(page, apiStatus),
  });

  const submissions = monitoringQuery.data?.results ?? EMPTY_MONITORING;
  const editorOptions = Array.from(
    new Map(
      submissions
        .filter((submission) => submission.assigned_editor)
        .map((submission) => [
          submission.assigned_editor!.id,
          submission.assigned_editor!,
        ]),
    ).values(),
  ).sort((first, second) =>
    first.full_name.localeCompare(second.full_name),
  );

  const filteredSubmissions = submissions
    .filter(
      (submission) =>
        matchesSearch(submission, searchTerm) &&
        matchesAttentionFilter(submission, attentionFilter) &&
        (editorFilter === "ALL" ||
          submission.assigned_editor?.id === editorFilter),
    )
    .toSorted((first, second) => {
      return attentionWeight(second) - attentionWeight(first);
    });

  const hasPreviousPage = Boolean(monitoringQuery.data?.previous);
  const hasNextPage = Boolean(monitoringQuery.data?.next);
  const clientFiltersActive =
    Boolean(searchTerm.trim()) ||
    attentionFilter !== "ALL" ||
    editorFilter !== "ALL";
  const flaggedOnPage = submissions.filter(
    (submission) => submission.attention_flags.length > 0,
  ).length;
  const overdueOnPage = submissions.filter(hasOverdueWork).length;

  function changeStatus(nextStatus: MonitoringStatusFilter) {
    setStatusFilter(nextStatus);
    setPage(1);
    clearCurrentPageFilters();
  }

  function clearCurrentPageFilters() {
    setSearchTerm("");
    setAttentionFilter("ALL");
    setEditorFilter("ALL");
  }

  function changePage(nextPage: number) {
    clearCurrentPageFilters();
    setPage(nextPage);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Section-wide monitoring"
        title="Active manuscripts"
        description="Supervise editor responsibility, reviewer progress, revision rounds, and backend-reported overdue or stalled conditions."
      />

      <section
        aria-label="Loaded monitoring page summary"
        className="grid overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs sm:grid-cols-3"
      >
        <SummaryItem
          label="Matching status"
          value={monitoringQuery.data?.count ?? 0}
          description="Across all API pages"
        />
        <SummaryItem
          label="Flagged"
          value={flaggedOnPage}
          description="On the loaded page"
        />
        <SummaryItem
          label="Overdue"
          value={overdueOnPage}
          description="On the loaded page"
        />
      </section>

      <section
        aria-label="Active manuscript filters"
        className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-xs lg:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_14rem_14rem_14rem_auto] xl:items-end"
      >
        <div>
          <label
            htmlFor="monitoring-search"
            className="text-sm font-medium text-foreground"
          >
            Search loaded manuscripts
          </label>
          <div className="relative mt-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="monitoring-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Title, section, or editor"
              className="min-h-11 pl-9"
            />
          </div>
        </div>

        <FilterSelect
          id="monitoring-status-filter"
          label="Workflow status"
          value={statusFilter}
          onChange={(value) =>
            changeStatus(value as MonitoringStatusFilter)
          }
          options={statusOptions}
        />

        <FilterSelect
          id="monitoring-attention-filter"
          label="Attention"
          value={attentionFilter}
          onChange={(value) => setAttentionFilter(value as AttentionFilter)}
          options={attentionOptions}
        />

        <FilterSelect
          id="monitoring-editor-filter"
          label="Section Editor"
          value={editorFilter}
          onChange={setEditorFilter}
          options={[
            { value: "ALL", label: "All loaded editors" },
            ...editorOptions.map((editor) => ({
              value: editor.id,
              label: editor.full_name,
            })),
          ]}
        />

        <Button
          type="button"
          variant="ghost"
          size="touch"
          disabled={!clientFiltersActive}
          onClick={clearCurrentPageFilters}
        >
          Clear page filters
        </Button>

        <p className="text-xs leading-5 text-muted-foreground lg:col-span-2 xl:col-span-5">
          Workflow status is filtered by the backend across all pages. Search,
          attention, and editor filters apply to the currently loaded page.
          Overdue cases are displayed first without recalculating backend
          priority.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        <header className="flex flex-col gap-2 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Managed cases
            </h2>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {monitoringQuery.data
                ? `${monitoringQuery.data.count} manuscript${
                    monitoringQuery.data.count === 1 ? "" : "s"
                  } match the workflow-status filter`
                : "Loading active manuscripts"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Page {page}
            {clientFiltersActive
              ? ` · ${filteredSubmissions.length} shown on this page`
              : ""}
            {monitoringQuery.isFetching && !monitoringQuery.isLoading
              ? " · Refreshing"
              : ""}
          </p>
        </header>

        {monitoringQuery.isLoading ? (
          <MonitoringSkeleton />
        ) : monitoringQuery.isError ? (
          <div className="p-5">
            <ErrorState
              title="Could not load active manuscripts"
              description="Check your connection and try loading the monitoring queue again."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void monitoringQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </Button>
              }
            />
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={
                statusFilter === "ALL"
                  ? "No active manuscripts"
                  : "No manuscripts match this workflow status"
              }
              description={
                statusFilter === "ALL"
                  ? "Manuscripts appear here after triage and Section Editor assignment."
                  : "Choose another workflow status to view different managed cases."
              }
              action={
                <Activity
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
              }
            />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No loaded manuscripts match these page filters"
              description="Clear or adjust the search, attention, or editor filter."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearCurrentPageFilters}
                >
                  Clear page filters
                </Button>
              }
            />
          </div>
        ) : (
          <ResponsiveQueue
            table={
              <MonitoringTable
                submissions={filteredSubmissions}
                onReassign={setReassignmentTarget}
              />
            }
            cards={filteredSubmissions.map((submission) => (
              <MonitoringMobileCard
                key={submission.id}
                submission={submission}
                onReassign={setReassignmentTarget}
              />
            ))}
            tableFrom="xl"
          />
        )}

        {monitoringQuery.data && submissions.length > 0 ? (
          <nav
            aria-label="Active manuscript pagination"
            className="flex flex-col gap-3 border-t border-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!hasPreviousPage || monitoringQuery.isFetching}
                onClick={() => changePage(Math.max(1, page - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!hasNextPage || monitoringQuery.isFetching}
                onClick={() => changePage(page + 1)}
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

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-2">
        <Filter
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="block min-h-11 w-full appearance-none rounded-lg border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronRight
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
        />
      </div>
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
    <table className="min-w-full divide-y divide-border/80">
      <caption className="sr-only">
        Active manuscripts and editorial review progress
      </caption>
      <thead className="bg-muted/45">
        <tr>
          {[
            "Manuscript",
            "Status",
            "Section Editor",
            "Version",
            "Review progress",
            "Attention",
            "Action",
          ].map((heading) => (
            <th
              key={heading}
              scope="col"
              className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground ${
                heading === "Action" ? "text-right" : ""
              }`}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/80">
        {submissions.map((submission) => (
          <tr key={submission.id} className="hover:bg-muted/25">
            <td className="max-w-sm px-5 py-4 align-top">
              <ManuscriptSummary
                title={submission.title}
                metadata={
                  <>
                    <span>{submission.section.name}</span>
                    <span className="mt-1 block text-xs">
                      {formatWaitingAge(submission.submitted_at)}
                    </span>
                  </>
                }
              />
            </td>
            <td className="px-5 py-4 align-top">
              <SubmissionStatusBadge status={submission.status} />
            </td>
            <td className="px-5 py-4 align-top">
              <p className="text-sm font-medium text-foreground" dir="auto">
                {submission.assigned_editor?.full_name ??
                  "No editor assigned"}
              </p>
              {submission.assigned_editor?.affiliation ? (
                <p
                  className="mt-1 max-w-48 text-xs text-muted-foreground"
                  dir="auto"
                >
                  {submission.assigned_editor.affiliation}
                </p>
              ) : null}
            </td>
            <td className="px-5 py-4 align-top">
              <p className="text-sm font-medium text-foreground">
                {submission.latest_version_number === null
                  ? "No version"
                  : `Version ${submission.latest_version_number}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRevisionRounds(submission.revision_round_count)}
              </p>
            </td>
            <td className="min-w-72 px-5 py-4 align-top">
              <ReviewProgress progress={submission.review_progress} />
            </td>
            <td className="min-w-56 px-5 py-4 align-top">
              {submission.attention_flags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {submission.attention_flags.map((flag) => (
                    <AttentionFlagBadge key={flag} flag={flag} />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No active flags
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-right align-top">
              <Button
                type="button"
                variant="outline"
                size="touch"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <ManuscriptSummary
          title={submission.title}
          headingLevel={2}
          metadata={
            <>
              {submission.section.name}
              <span aria-hidden="true"> · </span>
              {formatWaitingAge(submission.submitted_at)}
            </>
          }
        />
        <SubmissionStatusBadge status={submission.status} />
      </div>

      <dl className="mt-4 grid gap-4 rounded-lg bg-muted/45 p-4 sm:grid-cols-2">
        <MetadataItem
          label="Section Editor"
          value={submission.assigned_editor?.full_name ?? "No editor assigned"}
        />
        <MetadataItem
          label="Submitted"
          value={formatDate(submission.submitted_at)}
        />
        <MetadataItem
          label="Current version"
          value={
            submission.latest_version_number === null
              ? "No version"
              : `Version ${submission.latest_version_number}`
          }
        />
        <MetadataItem
          label="Revision history"
          value={formatRevisionRounds(submission.revision_round_count)}
        />
      </dl>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">
          Review progress
        </h3>
        <div className="mt-3">
          <ReviewProgress progress={submission.review_progress} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">Attention</h3>
        {submission.attention_flags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {submission.attention_flags.map((flag) => (
              <AttentionFlagBadge key={flag} flag={flag} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No active attention flags.
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="touch"
        disabled={!submission.assigned_editor}
        onClick={() => onReassign(submission)}
        className="mt-5 w-full"
      >
        Reassign Section Editor
      </Button>
    </article>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground" dir="auto">
        {value}
      </dd>
    </div>
  );
}

function MonitoringSkeleton() {
  return (
    <div
      aria-label="Loading active manuscripts"
      aria-busy="true"
      className="divide-y divide-border/80"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="mt-5 h-24 animate-pulse rounded bg-muted/60" />
        </div>
      ))}
    </div>
  );
}
