"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { getMySubmissions } from "@/features/submissions/api/submissions-api";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import type {
  AuthorSubmissionListItem,
  SubmissionStatus,
} from "@/features/submissions/types";

const statusFilterOptions: Array<{
  label: string;
  value: SubmissionStatus | "ALL";
}> = [
  { label: "All statuses", value: "ALL" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Assigned to editor", value: "ASSIGNED" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Reviews completed", value: "REVIEWED" },
  { label: "Revision requested", value: "UNDER_REVISION" },
  { label: "Revision submitted", value: "REVISED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
];
const EMPTY_SUBMISSIONS: AuthorSubmissionListItem[] = [];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getSectionName(submission: AuthorSubmissionListItem) {
  return submission.section?.name ?? "Unassigned section";
}

function matchesSearch(
  submission: AuthorSubmissionListItem,
  searchTerm: string,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return (
    submission.title.toLowerCase().includes(normalizedSearch) ||
    submission.abstract.toLowerCase().includes(normalizedSearch) ||
    getSectionName(submission).toLowerCase().includes(normalizedSearch)
  );
}

export function AuthorSubmissionsPage() {
  const [page, setPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    SubmissionStatus | "ALL"
  >("ALL");

  const submissionsQuery = useQuery({
    queryKey: ["author-submissions", page],
    queryFn: () => getMySubmissions(page),
  });

  const submissions = submissionsQuery.data?.results ?? EMPTY_SUBMISSIONS;

  const filteredSubmissions = React.useMemo(() => {
    return submissions.filter((submission) => {
      const statusMatches =
        statusFilter === "ALL" || submission.status === statusFilter;

      return statusMatches && matchesSearch(submission, searchTerm);
    });
  }, [searchTerm, statusFilter, submissions]);

  const hasNextPage = Boolean(submissionsQuery.data?.next);
  const hasPreviousPage = Boolean(submissionsQuery.data?.previous);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Author workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              My Submissions
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review your manuscript history, track editorial progress, and
              respond to revision requests.
            </p>
          </div>

          <Link
            href="/author/submissions/new"
            className="inline-flex justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Submit new manuscript
          </Link>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div>
            <label
              htmlFor="submission-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search submissions
            </label>
            <input
              id="submission-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, abstract, or section"
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
          </div>

          <div>
            <label
              htmlFor="submission-status"
              className="block text-sm font-medium text-slate-700"
            >
              Status
            </label>
            <select
              id="submission-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as SubmissionStatus | "ALL")
              }
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Submission history
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {submissionsQuery.data
              ? `${submissionsQuery.data.count} total submission${
                  submissionsQuery.data.count === 1 ? "" : "s"
                }`
              : "Loading submissions..."}
          </p>
        </div>

        {submissionsQuery.isLoading ? (
          <SubmissionListSkeleton />
        ) : submissionsQuery.isError ? (
          <div className="p-6">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-900">
                Could not load submissions
              </h3>
              <p className="mt-1 text-sm text-red-700">
                Please check your connection and try again.
              </p>
            </div>
          </div>
        ) : submissions.length === 0 ? (
          <EmptySubmissionsState />
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-6">
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
              <h3 className="text-sm font-semibold text-slate-950">
                No matching submissions
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Try changing your search term or status filter.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <SubmissionsTable submissions={filteredSubmissions} />
            </div>

            <div className="divide-y md:hidden">
              {filteredSubmissions.map((submission) => (
                <SubmissionMobileCard
                  key={submission.id}
                  submission={submission}
                />
              ))}
            </div>
          </>
        )}

        {submissionsQuery.data && submissions.length > 0 ? (
          <div className="flex items-center justify-between border-t px-5 py-4">
            <p className="text-sm text-slate-500">Page {page}</p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!hasPreviousPage}
                onClick={() => setPage((currentPage) => currentPage - 1)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasNextPage}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SubmissionsTable({
  submissions,
}: {
  submissions: AuthorSubmissionListItem[];
}) {
  return (
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manuscript
          </th>
          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            Section
          </th>
          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </th>
          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            Submitted
          </th>
          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
            Action
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-200 bg-white">
        {submissions.map((submission) => (
          <tr key={submission.id} className="hover:bg-slate-50">
            <td className="max-w-md px-5 py-4">
              <Link
                href={`/author/submissions/${submission.id}`}
                className="font-medium text-slate-950 hover:underline"
              >
                {submission.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {submission.abstract}
              </p>
            </td>

            <td className="px-5 py-4 text-sm text-slate-600">
              {getSectionName(submission)}
            </td>

            <td className="px-5 py-4">
              <SubmissionStatusBadge status={submission.status} />
            </td>

            <td className="px-5 py-4 text-sm text-slate-600">
              {formatDate(submission.submitted_at)}
            </td>

            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-2">
                {submission.status === "UNDER_REVISION" ? (
                  <Link
                    href={`/author/submissions/${submission.id}`}
                    className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                  >
                    Upload revision
                  </Link>
                ) : null}

                <Link
                  href={`/author/submissions/${submission.id}`}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  View
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubmissionMobileCard({
  submission,
}: {
  submission: AuthorSubmissionListItem;
}) {
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/author/submissions/${submission.id}`}
            className="font-medium text-slate-950 hover:underline"
          >
            {submission.title}
          </Link>
          <p className="mt-1 text-sm text-slate-500">
            {getSectionName(submission)} - {formatDate(submission.submitted_at)}
          </p>
        </div>

        <SubmissionStatusBadge status={submission.status} />
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-slate-600">
        {submission.abstract}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {submission.status === "UNDER_REVISION" ? (
          <Link
            href={`/author/submissions/${submission.id}`}
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            Upload revision
          </Link>
        ) : null}

        <Link
          href={`/author/submissions/${submission.id}`}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View details
        </Link>
      </div>
    </article>
  );
}

function EmptySubmissionsState() {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
        <h3 className="text-base font-semibold text-slate-950">
          No submissions yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Once you submit a manuscript, it will appear here with its editorial
          status and version history.
        </p>
        <Link
          href="/author/submissions/new"
          className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Submit your first manuscript
        </Link>
      </div>
    </div>
  );
}

function SubmissionListSkeleton() {
  return (
    <div className="divide-y">
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
