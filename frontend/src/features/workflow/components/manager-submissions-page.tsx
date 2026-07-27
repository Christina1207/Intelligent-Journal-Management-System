"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ManuscriptSummary,
  ResponsiveQueue,
} from "@/features/editorial/components";
import { getManagerQueue } from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import {
  getManagerQueueActionLabel,
  getManagerQueueStage,
  ManagerQueueStageBadge,
  type ManagerQueueStage,
} from "@/features/workflow/components/manager-queue-stage";
import {
  type QueueTriageQueryState,
  useManagerQueueTriageStates,
} from "@/features/workflow/hooks";
import type { ManagerQueueSubmission } from "@/features/workflow/types";
import { cn } from "@/lib/utils";

type TriageFilter = "ALL" | Exclude<ManagerQueueStage, "UNAVAILABLE">;

const EMPTY_QUEUE: ManagerQueueSubmission[] = [];

const languageNames = new Intl.DisplayNames(["en"], {
  type: "language",
});

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
    : `${days} ${days === 1 ? "day" : "days"} waiting`;
}

function formatLanguage(languageCode: string) {
  return languageNames.of(languageCode) ?? languageCode.toUpperCase();
}

function matchesSearch(submission: ManagerQueueSubmission, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return (
    submission.title.toLowerCase().includes(normalizedSearch) ||
    submission.abstract.toLowerCase().includes(normalizedSearch) ||
    submission.section.name.toLowerCase().includes(normalizedSearch) ||
    formatLanguage(submission.language).toLowerCase().includes(normalizedSearch)
  );
}

function matchesTriageFilter(
  submission: ManagerQueueSubmission,
  filter: TriageFilter,
  triageStates: Map<string, QueueTriageQueryState>,
) {
  if (filter === "ALL") {
    return true;
  }

  const state = triageStates.get(submission.id);

  if (!state || state.isPending) {
    return true;
  }

  return !state.isError && getManagerQueueStage(state.data) === filter;
}

export function ManagerSubmissionsPage() {
  const [page, setPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [triageFilter, setTriageFilter] = React.useState<TriageFilter>("ALL");

  const queueQuery = useQuery({
    queryKey: managerQueryKeys.queue(page),
    queryFn: () => getManagerQueue(page),
  });

  const submissions = queueQuery.data?.results ?? EMPTY_QUEUE;
  const triageQueries = useManagerQueueTriageStates(
    submissions.map((submission) => submission.id),
  );

  const filteredSubmissions = React.useMemo(
    () =>
      submissions.filter(
        (submission) =>
          matchesSearch(submission, searchTerm) &&
          matchesTriageFilter(
            submission,
            triageFilter,
            triageQueries.bySubmissionId,
          ),
      ),
    [
      searchTerm,
      submissions,
      triageFilter,
      triageQueries.bySubmissionId,
    ],
  );

  const hasPreviousPage = Boolean(queueQuery.data?.previous);
  const hasNextPage = Boolean(queueQuery.data?.next);
  const filtersActive = Boolean(searchTerm.trim()) || triageFilter !== "ALL";

  function changePage(nextPage: number) {
    setSearchTerm("");
    setTriageFilter("ALL");
    setPage(nextPage);
  }

  function clearFilters() {
    setSearchTerm("");
    setTriageFilter("ALL");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Initial screening"
        title="Submitted manuscript queue"
        description="Review scope, completeness, basic scholarly quality, guideline compliance, and ethics disclosures before assigning editorial responsibility."
      />

      <section
        aria-label="Screening queue filters"
        className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-xs md:grid-cols-[minmax(0,1fr)_18rem_auto] md:items-end"
      >
        <div>
          <label
            htmlFor="manager-submission-search"
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
              id="manager-submission-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Title, abstract, section, or language"
              aria-describedby="manager-search-scope"
              className="min-h-11 pl-9"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="manager-triage-filter"
            className="text-sm font-medium text-foreground"
          >
            Required next step
          </label>
          <div className="relative mt-2">
            <Filter
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              id="manager-triage-filter"
              value={triageFilter}
              disabled={triageQueries.isPending}
              onChange={(event) =>
                setTriageFilter(event.target.value as TriageFilter)
              }
              className="block min-h-11 w-full appearance-none rounded-lg border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 disabled:opacity-60"
            >
              <option value="ALL">All next steps</option>
              <option value="AWAITING_TRIAGE">Triage required</option>
              <option value="READY_FOR_ASSIGNMENT">
                Editor assignment required
              </option>
            </select>
            <ChevronRight
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="touch"
          disabled={!filtersActive}
          onClick={clearFilters}
        >
          Clear filters
        </Button>

        <p
          id="manager-search-scope"
          className="text-xs leading-5 text-muted-foreground md:col-span-3"
        >
          Search and next-step filters apply to the current API page. Page
          changes clear these filters.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        <header className="flex flex-col gap-2 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Manager action queue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {queueQuery.data
                ? `${queueQuery.data.count} submitted manuscript${
                    queueQuery.data.count === 1 ? "" : "s"
                  } across your managed sections`
                : "Loading submitted manuscripts"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Page {page}
            {filtersActive
              ? ` · ${filteredSubmissions.length} shown on this page`
              : ""}
            {queueQuery.isFetching && !queueQuery.isLoading
              ? " · Refreshing"
              : ""}
          </p>
        </header>

        {queueQuery.isLoading ? (
          <ScreeningQueueSkeleton />
        ) : queueQuery.isError ? (
          <div className="p-5">
            <ErrorState
              title="Could not load the submitted queue"
              description="Check your connection and try loading the manuscripts again."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void queueQuery.refetch()}
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
              title="Submitted queue is clear"
              description="There are no manuscripts awaiting triage or initial editor assignment in your managed sections."
              action={
                <ClipboardCheck
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
              }
            />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No manuscripts match these filters"
              description="Adjust the search term or required-next-step filter."
              action={
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <ResponsiveQueue
            table={
              <ScreeningQueueTable
                submissions={filteredSubmissions}
                triageStates={triageQueries.bySubmissionId}
              />
            }
            cards={filteredSubmissions.map((submission) => (
              <ScreeningQueueMobileCard
                key={submission.id}
                submission={submission}
                triageState={triageQueries.bySubmissionId.get(submission.id)}
              />
            ))}
          />
        )}

        {queueQuery.data && submissions.length > 0 ? (
          <nav
            aria-label="Submitted queue pagination"
            className="flex flex-col gap-3 border-t border-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!hasPreviousPage || queueQuery.isFetching}
                onClick={() => changePage(Math.max(1, page - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!hasNextPage || queueQuery.isFetching}
                onClick={() => changePage(page + 1)}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function ScreeningQueueTable({
  submissions,
  triageStates,
}: {
  submissions: ManagerQueueSubmission[];
  triageStates: Map<string, QueueTriageQueryState>;
}) {
  return (
    <table className="min-w-full divide-y divide-border/80">
      <caption className="sr-only">
        Submitted manuscripts awaiting triage or editor assignment
      </caption>
      <thead className="bg-muted/45">
        <tr>
          {["Manuscript", "Next step", "Language", "Submitted", "Action"].map(
            (heading) => (
              <th
                key={heading}
                scope="col"
                className={cn(
                  "px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                  heading === "Action" && "text-right",
                )}
              >
                {heading}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/80">
        {submissions.map((submission) => {
          const triageState = triageStates.get(submission.id);

          return (
            <tr key={submission.id} className="hover:bg-muted/25">
              <td className="max-w-xl px-5 py-4 align-top">
                <ManuscriptSummary
                  title={submission.title}
                  abstract={submission.abstract}
                  metadata={submission.section.name}
                />
              </td>
              <td className="px-5 py-4 align-top">
                <ManagerQueueStageBadge state={triageState} />
              </td>
              <td className="px-5 py-4 align-top text-sm text-text-secondary">
                {formatLanguage(submission.language)}
              </td>
              <td className="whitespace-nowrap px-5 py-4 align-top">
                <p className="text-sm text-text-secondary">
                  {formatDate(submission.submitted_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatWaitingAge(submission.submitted_at)}
                </p>
              </td>
              <td className="px-5 py-4 text-right align-top">
                <Link
                  href={`/manager/submissions/${submission.id}`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "touch",
                  })}
                >
                  {getManagerQueueActionLabel(triageState)}
                  <ChevronRight aria-hidden="true" />
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ScreeningQueueMobileCard({
  submission,
  triageState,
}: {
  submission: ManagerQueueSubmission;
  triageState: QueueTriageQueryState | undefined;
}) {
  return (
    <article className="p-5">
      <ManuscriptSummary
        title={submission.title}
        abstract={submission.abstract}
        headingLevel={2}
        metadata={submission.section.name}
      />

      <div className="mt-3">
        <ManagerQueueStageBadge state={triageState} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/45 p-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Language
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatLanguage(submission.language)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Submitted
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatDate(submission.submitted_at)}
          </dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            {formatWaitingAge(submission.submitted_at)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/manager/submissions/${submission.id}`}
        className={cn(
          buttonVariants({ size: "touch" }),
          "mt-4 w-full justify-center",
        )}
      >
        {getManagerQueueActionLabel(triageState)}
        <ChevronRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function ScreeningQueueSkeleton() {
  return (
    <div
      aria-label="Loading submitted manuscripts"
      aria-busy="true"
      className="divide-y divide-border/80"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="mt-4 h-3 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
