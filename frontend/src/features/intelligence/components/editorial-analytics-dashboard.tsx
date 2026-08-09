"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { getEditorialAnalyticsDashboard } from "@/features/intelligence/api/intelligence-api";
import { intelligenceQueryKeys } from "@/features/intelligence/api/intelligence-query-keys";
import type {
  EditorialAnalyticsDashboardResponse,
  PriorityQueueItem,
} from "@/features/intelligence/types";

type EditorialAnalyticsDashboardProps = {
  priorityItemBasePath?: string;
};

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDuration(value: number | null) {
  return value === null ? "Not available" : `${value.toFixed(1)} days`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  const normalizedValue = value.length === 10 ? `${value}T00:00:00Z` : value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(normalizedValue));
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function EditorialAnalyticsDashboard({
  priorityItemBasePath,
}: EditorialAnalyticsDashboardProps) {
  const analyticsQuery = useQuery({
    queryKey: intelligenceQueryKeys.editorialDashboard,
    queryFn: getEditorialAnalyticsDashboard,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Editorial overview
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Journal analytics
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor journal outcomes, workflow duration, overdue work and
              manuscripts requiring editorial attention.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={analyticsQuery.isFetching}
            onClick={() => {
              void analyticsQuery.refetch();
            }}
          >
            <RefreshCw
              aria-hidden="true"
              className={analyticsQuery.isFetching ? "animate-spin" : ""}
            />
            {analyticsQuery.isFetching ? "Refreshing" : "Refresh"}
          </Button>
        </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm leading-6 text-blue-900">
            Priority scores support workload ordering. They do not predict
            manuscript quality and never determine an editorial decision.
          </p>
        </div>
      </section>

      {analyticsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : analyticsQuery.isError ? (
        <DashboardError
          message={
            analyticsQuery.error instanceof Error
              ? analyticsQuery.error.message
              : "The analytics dashboard could not be loaded."
          }
          onRetry={() => {
            void analyticsQuery.refetch();
          }}
        />
      ) : analyticsQuery.data ? (
        <DashboardContent
          data={analyticsQuery.data}
          priorityItemBasePath={priorityItemBasePath}
        />
      ) : null}
    </div>
  );
}

function DashboardContent({
  data,
  priorityItemBasePath,
}: {
  data: EditorialAnalyticsDashboardResponse;
  priorityItemBasePath?: string;
}) {
  const summary = data.summary;

  const publicationsByMonth = new Map(
    data.publications_over_time.map((point) => [point.month, point.count]),
  );

  const trends = data.submissions_over_time.map((point) => ({
    month: point.month,
    submissions: point.count,
    publications: publicationsByMonth.get(point.month) ?? 0,
  }));

  const topicItems = [
    ...data.topic_distribution.topics.map((topic) => ({
      key: topic.label,
      label: topic.label,
      value: topic.submission_count,
    })),
    ...(data.topic_distribution.unclassified_count > 0
      ? [
          {
            key: "unclassified",
            label: "Unclassified",
            value: data.topic_distribution.unclassified_count,
          },
        ]
      : []),
  ];

  return (
    <>
      <section
        aria-label="Journal summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <SummaryCard
          label="Total submissions"
          value={summary.total_submissions}
          hint="All manuscripts recorded"
        />

        <SummaryCard
          label="Publications"
          value={summary.total_publications}
          hint="Published journal articles"
        />

        <SummaryCard
          label="Acceptance rate"
          value={formatPercentage(summary.acceptance_rate)}
          hint={`${summary.accepted_count} accepted final outcomes`}
        />

        <SummaryCard
          label="Rejection rate"
          value={formatPercentage(summary.rejection_rate)}
          hint={`${summary.rejected_count} rejected final outcomes`}
        />

        <SummaryCard
          label="Median decision duration"
          value={formatDuration(summary.median_decision_duration_days)}
          hint="Submission to final decision"
        />

        <SummaryCard
          label="Median review duration"
          value={formatDuration(summary.median_review_duration_days)}
          hint="Assignment to submitted review"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Submission status"
          description="Current distribution across the editorial lifecycle."
        >
          <DistributionList
            items={data.status_distribution.map((item) => ({
              key: item.code,
              label: item.label,
              value: item.count,
            }))}
            emptyMessage="No submissions have been recorded."
          />
        </Panel>

        <Panel
          title="Submissions and publications"
          description="Monthly activity during the last twelve months."
        >
          <TimeTrend points={trends} />
        </Panel>

        <Panel
          title="Sections"
          description="Submission volume by journal section."
        >
          <DistributionList
            items={data.section_distribution.map((item) => ({
              key: item.id,
              label: item.name,
              value: item.submission_count,
            }))}
            emptyMessage="No section activity is available."
          />
        </Panel>

        <Panel
          title="Research topics"
          description="Submission volume by classified research topic."
        >
          <DistributionList
            items={topicItems}
            emptyMessage="No topic classifications are available."
          />
        </Panel>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Overdue work</h2>
          <p className="mt-1 text-sm text-slate-500">
            Work requiring follow-up according to the configured deadlines.
          </p>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <OverdueMetric
            label="Overdue invitations"
            value={data.overdue_work.overdue_invitations}
          />
          <OverdueMetric
            label="Overdue reviews"
            value={data.overdue_work.overdue_reviews}
          />
          <OverdueMetric
            label="Total overdue items"
            value={data.overdue_work.total}
          />
        </dl>
      </section>

      <PriorityQueue
        items={data.priority_queue}
        priorityItemBasePath={priorityItemBasePath}
      />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="font-semibold text-slate-950">Duration definitions</h2>

        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-700">Decision duration</dt>
            <dd className="mt-1 text-slate-600">
              {data.duration_definitions.decision_duration}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-slate-700">Review duration</dt>
            <dd className="mt-1 text-slate-600">
              {data.duration_definitions.review_duration}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-slate-500">
          Dashboard generated {formatDateTime(data.generated_at)}
        </p>
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DistributionList({
  items,
  emptyMessage,
}: {
  items: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  emptyMessage: string;
}) {
  const visibleItems = items.filter((item) => item.value > 0);
  const maximum = Math.max(1, ...visibleItems.map((item) => item.value));

  if (visibleItems.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {visibleItems.map((item) => {
        const percentage = (item.value / maximum) * 100;

        return (
          <div key={item.key}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="tabular-nums text-slate-500">{item.value}</span>
            </div>

            <div
              role="progressbar"
              aria-label={`${item.label}: ${item.value}`}
              aria-valuemin={0}
              aria-valuemax={maximum}
              aria-valuenow={item.value}
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeTrend({
  points,
}: {
  points: Array<{
    month: string;
    submissions: number;
    publications: number;
  }>;
}) {
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.submissions, point.publications]),
  );

  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">No trend data is available.</p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-blue-600" />
          Submissions
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-600" />
          Publications
        </span>
      </div>

      <div className="space-y-3">
        {points.map((point) => (
          <div
            key={point.month}
            className="grid grid-cols-[4.5rem_1fr] items-start gap-3"
          >
            <span className="pt-0.5 text-xs font-medium text-slate-500">
              {formatMonth(point.month)}
            </span>

            <div className="space-y-1.5">
              <TrendBar
                label="Submissions"
                value={point.submissions}
                maximum={maximum}
                className="bg-blue-600"
              />
              <TrendBar
                label="Publications"
                value={point.publications}
                maximum={maximum}
                className="bg-emerald-600"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendBar({
  label,
  value,
  maximum,
  className,
}: {
  label: string;
  value: number;
  maximum: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        aria-label={`${label}: ${value}`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full ${className}`}
          style={{ width: `${(value / maximum) * 100}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs tabular-nums text-slate-500">
        {value}
      </span>
    </div>
  );
}

function OverdueMetric({ label, value }: { label: string; value: number }) {
  const hasOverdueWork = value > 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasOverdueWork
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <dt className={hasOverdueWork ? "text-amber-800" : "text-emerald-800"}>
        {label}
      </dt>
      <dd
        className={`mt-2 text-2xl font-bold ${
          hasOverdueWork ? "text-amber-950" : "text-emerald-950"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function PriorityQueue({
  items,
  priorityItemBasePath,
}: {
  items: PriorityQueueItem[];
  priorityItemBasePath?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          Editorial priority queue
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Active manuscripts ordered by the configured weighted priority score.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">
          There are no active manuscripts requiring editorial attention.
        </p>
      ) : (
        <div className="divide-y divide-slate-200">
          {items.map((item, index) => (
            <PriorityQueueItemCard
              key={item.submission_id}
              item={item}
              position={index + 1}
              priorityItemBasePath={priorityItemBasePath}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PriorityQueueItemCard({
  item,
  position,
  priorityItemBasePath,
}: {
  item: PriorityQueueItem;
  position: number;
  priorityItemBasePath?: string;
}) {
  return (
    <article className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">
              #{position}
            </span>
            <SubmissionStatusBadge status={item.status} />
          </div>

          <h3 className="mt-3 font-semibold text-slate-950">
            {priorityItemBasePath ? (
              <Link
                href={`${priorityItemBasePath}/${item.submission_id}`}
                className="hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            {item.section.name} · Version {item.latest_version_number} ·
            Submitted {formatDate(item.submitted_at)}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Responsible editor:{" "}
            {item.assigned_editor?.full_name ?? "Not yet assigned"}
          </p>
        </div>

        <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
            Priority score
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-950">
            {item.score.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-blue-700">{humanize(item.method)}</p>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
          Explain this score
        </summary>

        <div className="space-y-3 border-t border-slate-200 p-4">
          {item.factors.map((factor) => (
            <div key={factor.key}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {factor.label || humanize(factor.key)}
                </p>

                <p className="text-xs tabular-nums text-slate-500">
                  Factor {factor.score.toFixed(1)} · Weight{" "}
                  {factor.weight.toFixed(1)} · Contribution{" "}
                  {factor.contribution.toFixed(2)}
                </p>
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                {factor.explanation}
              </p>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading journal analytics">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 text-red-700"
        />

        <div>
          <h2 className="font-semibold text-red-950">
            Analytics could not be loaded
          </h2>
          <p className="mt-1 text-sm text-red-800">{message}</p>

          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}
