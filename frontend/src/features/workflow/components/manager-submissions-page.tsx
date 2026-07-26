"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { getManagerQueue } from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import type { ManagerQueueSubmission } from "@/features/workflow/types";

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

export function ManagerSubmissionsPage() {
  const [page, setPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");

  const queueQuery = useQuery({
    queryKey: managerQueryKeys.queue(page),
    queryFn: () => getManagerQueue(page),
  });

  const submissions = queueQuery.data?.results ?? EMPTY_QUEUE;

  const filteredSubmissions = React.useMemo(
    () =>
      submissions.filter((submission) => matchesSearch(submission, searchTerm)),
    [searchTerm, submissions],
  );

  const hasPreviousPage = Boolean(queueQuery.data?.previous);
  const hasNextPage = Boolean(queueQuery.data?.next);

  function goToPreviousPage() {
    if (!hasPreviousPage) {
      return;
    }

    setSearchTerm("");
    setPage((currentPage) => Math.max(1, currentPage - 1));
  }

  function goToNextPage() {
    if (!hasNextPage) {
      return;
    }

    setSearchTerm("");
    setPage((currentPage) => currentPage + 1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Initial screening</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          New manuscript queue
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review newly submitted manuscripts for scope, completeness, guideline
          compliance, basic scholarly quality, and required ethics disclosures.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="manager-submission-search"
          className="block text-sm font-medium text-slate-700"
        >
          Search this page
        </label>

        <div className="relative mt-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />

          <Input
            id="manager-submission-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by title, abstract, section, or language"
            aria-describedby="manager-search-scope"
            className="h-10 pl-9"
          />
        </div>

        <p id="manager-search-scope" className="mt-2 text-xs text-slate-500">
          Search applies only to manuscripts loaded on the current page.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Awaiting screening
              </h2>

              <p className="mt-1 text-sm text-slate-500" aria-live="polite">
                {queueQuery.data
                  ? `${queueQuery.data.count} manuscript${
                      queueQuery.data.count === 1 ? "" : "s"
                    } waiting across your managed sections`
                  : "Loading screening queue..."}
              </p>
            </div>

            {queueQuery.data && submissions.length > 0 ? (
              <p className="text-sm text-slate-500">
                Page {page}
                {searchTerm.trim()
                  ? ` · ${filteredSubmissions.length} matching on this page`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>

        {queueQuery.isLoading ? (
          <ScreeningQueueSkeleton />
        ) : queueQuery.isError ? (
          <ScreeningQueueError
            onRetry={() => {
              void queueQuery.refetch();
            }}
          />
        ) : submissions.length === 0 ? (
          <EmptyScreeningQueue />
        ) : filteredSubmissions.length === 0 ? (
          <NoMatchingSubmissions onClearSearch={() => setSearchTerm("")} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <ScreeningQueueTable submissions={filteredSubmissions} />
            </div>

            <div className="divide-y divide-slate-200 lg:hidden">
              {filteredSubmissions.map((submission) => (
                <ScreeningQueueMobileCard
                  key={submission.id}
                  submission={submission}
                />
              ))}
            </div>
          </>
        )}

        {queueQuery.data && submissions.length > 0 ? (
          <nav
            aria-label="Screening queue pagination"
            className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4"
          >
            <p className="text-sm text-slate-500">Page {page}</p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!hasPreviousPage || queueQuery.isFetching}
                onClick={goToPreviousPage}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!hasNextPage || queueQuery.isFetching}
                onClick={goToNextPage}
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
}: {
  submissions: ManagerQueueSubmission[];
}) {
  return (
    <table className="min-w-full divide-y divide-slate-200">
      <caption className="sr-only">
        Newly submitted manuscripts awaiting initial screening
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
            Section
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Language
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Submitted
          </th>
          <th
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Status
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
            <td className="max-w-md px-5 py-4 align-top">
              <h3 className="line-clamp-2 font-medium text-slate-950">
                {submission.title}
              </h3>

              <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                {submission.abstract}
              </p>
            </td>

            <td className="px-5 py-4 align-top text-sm text-slate-600">
              {submission.section.name}
            </td>

            <td className="px-5 py-4 align-top text-sm text-slate-600">
              {formatLanguage(submission.language)}
            </td>

            <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-600">
              {formatDate(submission.submitted_at)}
            </td>

            <td className="px-5 py-4 align-top">
              <SubmissionStatusBadge status={submission.status} />
            </td>

            <td className="px-5 py-4 text-right align-top">
              <Link
                href={`/manager/submissions/${submission.id}`}
                className="inline-flex justify-center rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Begin screening
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScreeningQueueMobileCard({
  submission,
}: {
  submission: ManagerQueueSubmission;
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

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {submission.abstract}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Language
          </dt>
          <dd className="mt-1 text-sm text-slate-700">
            {formatLanguage(submission.language)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Submitted
          </dt>
          <dd className="mt-1 text-sm text-slate-700">
            {formatDate(submission.submitted_at)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/manager/submissions/${submission.id}`}
        className="mt-4 inline-flex w-full justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        Begin screening
      </Link>
    </article>
  );
}

function ScreeningQueueError({ onRetry }: { onRetry: () => void }) {
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
              Could not load the screening queue
            </h3>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Check your connection and try loading the manuscripts again.
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

function EmptyScreeningQueue() {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
        <ClipboardCheck
          aria-hidden="true"
          className="mx-auto size-8 text-slate-400"
        />

        <h3 className="mt-4 text-base font-semibold text-slate-950">
          Screening queue is clear
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          There are currently no newly submitted manuscripts awaiting initial
          screening in your managed sections.
        </p>
      </div>
    </div>
  );
}

function NoMatchingSubmissions({
  onClearSearch,
}: {
  onClearSearch: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
        <Search aria-hidden="true" className="mx-auto size-7 text-slate-400" />

        <h3 className="mt-4 text-base font-semibold text-slate-950">
          No matching manuscripts
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Try a different search term or clear the current search.
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={onClearSearch}
          className="mt-4"
        >
          Clear search
        </Button>
      </div>
    </div>
  );
}

function ScreeningQueueSkeleton() {
  return (
    <div
      aria-label="Loading screening queue"
      aria-busy="true"
      className="divide-y divide-slate-200"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-3 w-full animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
