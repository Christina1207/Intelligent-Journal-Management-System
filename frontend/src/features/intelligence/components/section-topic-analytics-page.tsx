"use client";

import * as React from "react";
import { BarChart3, RefreshCw, Tags, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getSectionTopicAnalytics } from "@/features/intelligence/api/intelligence-api";
import { intelligenceQueryKeys } from "@/features/intelligence/api/intelligence-query-keys";
import type {
  SectionTopicAggregate,
  TopicAnalysisStatus,
} from "@/features/intelligence/types";

const EMPTY_SECTIONS: SectionTopicAggregate[] = [];

const STATUS_LABELS: Record<TopicAnalysisStatus, string> = {
  not_started: "Not started",
  partial: "Partially analyzed",
  complete: "Analysis complete",
};

const STATUS_STYLES: Record<TopicAnalysisStatus, string> = {
  not_started: "border-slate-200 bg-slate-100 text-slate-700",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet clustered";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getCoverage(section: SectionTopicAggregate) {
  if (section.total_submissions === 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (section.analyzed_submissions / section.total_submissions) * 100,
      ),
    ),
  );
}

export function SectionTopicAnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: intelligenceQueryKeys.sectionTopics,
    queryFn: getSectionTopicAnalytics,
  });

  const sections = analyticsQuery.data?.sections ?? EMPTY_SECTIONS;

  const totals = React.useMemo(
    () =>
      sections.reduce(
        (result, section) => ({
          submissions: result.submissions + section.total_submissions,
          analyzed: result.analyzed + section.analyzed_submissions,
          pending: result.pending + section.pending_analysis,
        }),
        {
          submissions: 0,
          analyzed: 0,
          pending: 0,
        },
      ),
    [sections],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Editorial intelligence
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Section research topics
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review topic clusters, analysis coverage and author-supplied
              keyword trends across the journal sections you manage.
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
            These aggregates are decision-support information. Detected clusters
            reflect the currently stored model output and may change when
            submissions are analyzed or reclustered.
          </p>
        </div>
      </section>

      {analyticsQuery.isLoading ? (
        <AnalyticsSkeleton />
      ) : analyticsQuery.isError ? (
        <AnalyticsError
          onRetry={() => {
            void analyticsQuery.refetch();
          }}
        />
      ) : sections.length === 0 ? (
        <EmptyAnalyticsState />
      ) : (
        <>
          <section
            aria-label="Topic analysis summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryCard label="Visible sections" value={sections.length} />
            <SummaryCard label="Submissions" value={totals.submissions} />
            <SummaryCard label="Analyzed" value={totals.analyzed} />
            <SummaryCard label="Awaiting analysis" value={totals.pending} />
          </section>

          <div className="space-y-6">
            {sections.map((section) => (
              <SectionAnalyticsCard
                key={section.section.id}
                section={section}
              />
            ))}
          </div>

          <p className="text-right text-xs text-slate-500">
            Generated {formatDateTime(analyticsQuery.data?.generated_at ?? null)}
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function SectionAnalyticsCard({ section }: { section: SectionTopicAggregate }) {
  const coverage = getCoverage(section);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {section.section.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Last clustered: {formatDateTime(section.last_clustered_at)}
            </p>
          </div>

          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
              STATUS_STYLES[section.analysis_status]
            }`}
          >
            {STATUS_LABELS[section.analysis_status]}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-slate-700">
              Analysis coverage
            </span>
            <span className="text-slate-500">
              {section.analyzed_submissions} of {section.total_submissions} (
              {coverage}%)
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={`${section.section.name} analysis coverage`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={coverage}
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          <Metric label="Total" value={section.total_submissions} />
          <Metric label="Clustered" value={section.clustered_submissions} />
          <Metric label="Outliers" value={section.outlier_submissions} />
          <Metric label="Pending" value={section.pending_analysis} />
        </dl>

        <AnalysisStatusMessage section={section} />
      </header>

      <div className="grid lg:grid-cols-2">
        <section className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <BarChart3 aria-hidden="true" className="size-5 text-slate-500" />
            <h3 className="font-semibold text-slate-950">
              Detected topic clusters
            </h3>
          </div>

          {section.topics.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              No stable topic clusters are currently available for this section.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {section.topics.map((topic) => {
                const percentage = Math.min(
                  100,
                  Math.max(0, topic.percentage_of_clustered),
                );

                return (
                  <article
                    key={`${topic.label}-${topic.submission_count}`}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-medium text-slate-900">
                        {topic.label}
                      </h4>

                      <span className="shrink-0 text-sm text-slate-500">
                        {topic.submission_count} submission
                        {topic.submission_count === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`${topic.label} share of clustered submissions`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                      className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {percentage.toFixed(1)}% of clustered submissions
                    </p>

                    {topic.keywords.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {topic.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="p-5">
          <div className="flex items-center gap-2">
            <Tags aria-hidden="true" className="size-5 text-slate-500" />
            <h3 className="font-semibold text-slate-950">
              Author keyword trends
            </h3>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Keywords supplied by authors, shown independently from generated
            topic clusters.
          </p>

          {section.top_author_keywords.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No author keywords have been recorded for this section.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200">
              {section.top_author_keywords.map((keyword) => (
                <li
                  key={keyword.keyword}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {keyword.keyword}
                  </span>
                  <span className="text-sm text-slate-500">
                    {keyword.submission_count} submission
                    {keyword.submission_count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function AnalysisStatusMessage({
  section,
}: {
  section: SectionTopicAggregate;
}) {
  if (section.total_submissions === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        This section has no eligible submissions yet.
      </p>
    );
  }

  if (section.analysis_status === "not_started") {
    return (
      <p className="mt-4 text-sm text-slate-600">
        Topic analysis has not run yet. Author-supplied keyword aggregates
        remain available.
      </p>
    );
  }

  if (section.analysis_status === "partial") {
    return (
      <p className="mt-4 text-sm text-amber-800">
        {section.pending_analysis} submission
        {section.pending_analysis === 1 ? "" : "s"} still await topic analysis.
      </p>
    );
  }

  return null;
}

function AnalyticsError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-700"
        />

        <div>
          <h2 className="font-semibold text-red-900">
            Could not load section intelligence
          </h2>

          <p className="mt-1 text-sm leading-6 text-red-700">
            The service may be unavailable, or your account may not have access
            to section aggregates.
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
    </section>
  );
}

function EmptyAnalyticsState() {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <BarChart3 aria-hidden="true" className="mx-auto size-9 text-slate-400" />

      <h2 className="mt-4 font-semibold text-slate-950">No managed sections</h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        No active journal sections are currently available to this editorial
        account.
      </p>
    </section>
  );
}

function AnalyticsSkeleton() {
  return (
    <div
      aria-label="Loading section intelligence"
      aria-busy="true"
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl bg-slate-200"
          />
        ))}
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="h-96 animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}
