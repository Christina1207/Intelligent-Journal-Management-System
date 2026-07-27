"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileSearch,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeader } from "@/components/common/section-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllMySubmissions } from "@/features/submissions/api/submissions-api";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { submissionQueryKeys } from "@/features/submissions/query-keys";
import { formatSubmissionDate } from "@/features/submissions/submission-formatters";
import type {
  AuthorSubmissionListItem,
  SubmissionStatus,
} from "@/features/submissions/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const EMPTY_SUBMISSIONS: AuthorSubmissionListItem[] = [];

const statusFilterOptions: Array<{
  label: string;
  value: SubmissionStatus | "ALL";
}> = [
  { label: "All statuses", value: "ALL" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Assigned to editorial handling", value: "ASSIGNED" },
  { label: "Under peer review", value: "UNDER_REVIEW" },
  { label: "Reviews received", value: "REVIEWED" },
  { label: "Revision requested", value: "UNDER_REVISION" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
];

export function AuthorSubmissionsPage() {
  const [page, setPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    SubmissionStatus | "ALL"
  >("ALL");
  const [sectionFilter, setSectionFilter] = React.useState("ALL");
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const submissionsQuery = useQuery({
    queryKey: submissionQueryKeys.list(),
    queryFn: getAllMySubmissions,
  });
  const submissions = submissionsQuery.data?.results ?? EMPTY_SUBMISSIONS;

  const sections = React.useMemo(
    () =>
      Array.from(
        new Map(
          submissions.map((submission) => [
            submission.section.id,
            submission.section,
          ]),
        ).values(),
      ).sort((first, second) => first.name.localeCompare(second.name)),
    [submissions],
  );

  const filteredSubmissions = React.useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLocaleLowerCase();

    return submissions.filter((submission) => {
      const titleMatches =
        !normalizedSearch ||
        submission.title.toLocaleLowerCase().includes(normalizedSearch);
      const statusMatches =
        statusFilter === "ALL" || submission.status === statusFilter;
      const sectionMatches =
        sectionFilter === "ALL" || submission.section.id === sectionFilter;

      return titleMatches && statusMatches && sectionMatches;
    });
  }, [deferredSearchTerm, sectionFilter, statusFilter, submissions]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    statusFilter !== "ALL" ||
    sectionFilter !== "ALL";

  function resetPageAndSearch(value: string) {
    setSearchTerm(value);
    setPage(1);
  }

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setSectionFilter("ALL");
    setPage(1);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Author workspace"
        title="My submissions"
        description="Search your manuscript record, check editorial status, and open any submission that needs attention."
        actions={
          <Link
            href="/author/submissions/new"
            className={buttonVariants({ variant: "accent", size: "touch" })}
          >
            <FilePlus2 aria-hidden="true" />
            New submission
          </Link>
        }
      />

      <Card>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_14rem_14rem]">
            <div>
              <label
                htmlFor="submission-search"
                className="text-sm font-medium text-foreground"
              >
                Search by manuscript title
              </label>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="submission-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => resetPageAndSearch(event.target.value)}
                  placeholder="Enter a title"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="submission-status"
                className="text-sm font-medium text-foreground"
              >
                Status
              </label>
              <Select
                id="submission-status"
                className="mt-2"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value as SubmissionStatus | "ALL",
                  );
                  setPage(1);
                }}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label
                htmlFor="submission-section"
                className="text-sm font-medium text-foreground"
              >
                Section
              </label>
              <Select
                id="submission-section"
                className="mt-2"
                value={sectionFilter}
                onChange={(event) => {
                  setSectionFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex min-h-8 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-text-secondary" role="status">
              {submissionsQuery.data
                ? `${filteredSubmissions.length} of ${submissions.length} submission${
                    submissions.length === 1 ? "" : "s"
                  }`
                : "Loading submissions…"}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className={buttonVariants({ variant: "ghost", size: "touch" })}
              >
                <RotateCcw aria-hidden="true" />
                Clear filters
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="submission-history-heading">
        <SectionHeader
          title="Submission history"
          titleId="submission-history-heading"
          description="Only author-visible manuscript and workflow information is shown."
        />

        {submissionsQuery.isFetching && !submissionsQuery.isLoading ? (
          <p
            className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <RefreshCw
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Updating submissions…
          </p>
        ) : null}

        <div className="mt-4">
          {submissionsQuery.isLoading ? (
            <SubmissionListSkeleton />
          ) : submissionsQuery.isError ? (
            <ErrorState
              title="Could not load submissions"
              description="Check your connection and try loading your submission history again."
              action={
                <button
                  type="button"
                  className={buttonVariants({
                    variant: "outline",
                    size: "touch",
                  })}
                  onClick={() => submissionsQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </button>
              }
            />
          ) : submissions.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 aria-hidden="true" />}
              title="No submissions yet"
              description="Your manuscripts will appear here after they enter the journal workflow."
              action={
                <Link
                  href="/author/submissions/new"
                  className={buttonVariants({
                    variant: "accent",
                    size: "touch",
                  })}
                >
                  Submit your first manuscript
                </Link>
              }
            />
          ) : filteredSubmissions.length === 0 ? (
            <EmptyState
              icon={<FileSearch aria-hidden="true" />}
              title="No submissions match"
              description="Try a different title, status, or section."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className={buttonVariants({
                    variant: "outline",
                    size: "touch",
                  })}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <Card className="hidden py-0 md:block">
                <SubmissionsTable submissions={visibleSubmissions} />
              </Card>
              <Card className="divide-y divide-border py-0 md:hidden">
                {visibleSubmissions.map((submission) => (
                  <SubmissionMobileRow
                    key={submission.id}
                    submission={submission}
                  />
                ))}
              </Card>
              <SubmissionPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
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
    <Table>
      <TableHeader className="bg-surface-muted">
        <TableRow>
          <TableHead className="px-4">Manuscript</TableHead>
          <TableHead>Section</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="px-4 text-right">
            <span className="sr-only">Open submission</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((submission) => {
          const submittedDate = formatSubmissionDate(submission.submitted_at);

          return (
            <TableRow key={submission.id}>
              <TableCell className="max-w-lg px-4 py-4 whitespace-normal">
                <Link
                  href={`/author/submissions/${submission.id}`}
                  className="font-heading font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  dir="auto"
                >
                  {submission.title}
                </Link>
              </TableCell>
              <TableCell className="max-w-48 whitespace-normal text-text-secondary">
                <span dir="auto">{submission.section.name}</span>
                {submission.topic?.label ? (
                  <span
                    className="mt-1 block text-xs text-muted-foreground"
                    dir="auto"
                  >
                    {submission.topic.label}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-normal">
                <SubmissionStatusBadge status={submission.status} />
              </TableCell>
              <TableCell className="text-text-secondary">
                {submittedDate ?? "—"}
              </TableCell>
              <TableCell className="px-4 text-right">
                <Link
                  href={`/author/submissions/${submission.id}${
                    submission.status === "UNDER_REVISION"
                      ? "#revision-upload"
                      : ""
                  }`}
                  className={buttonVariants({
                    variant:
                      submission.status === "UNDER_REVISION"
                        ? "default"
                        : "outline",
                    size: "touch",
                  })}
                >
                  {submission.status === "UNDER_REVISION"
                    ? "Review request"
                    : "View details"}
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SubmissionMobileRow({
  submission,
}: {
  submission: AuthorSubmissionListItem;
}) {
  const submittedDate = formatSubmissionDate(submission.submitted_at);

  return (
    <article className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SubmissionStatusBadge status={submission.status} />
        {submittedDate ? (
          <span className="text-xs text-muted-foreground">
            Submitted {submittedDate}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 font-heading font-medium text-foreground" dir="auto">
        {submission.title}
      </h3>
      <p className="mt-1 text-sm text-text-secondary" dir="auto">
        {submission.section.name}
        {submission.topic?.label ? ` · ${submission.topic.label}` : ""}
      </p>
      <Link
        href={`/author/submissions/${submission.id}${
          submission.status === "UNDER_REVISION" ? "#revision-upload" : ""
        }`}
        className={cn(
          buttonVariants({
            variant:
              submission.status === "UNDER_REVISION" ? "default" : "outline",
            size: "touch",
          }),
          "mt-4 w-full",
        )}
      >
        {submission.status === "UNDER_REVISION"
          ? "Review request"
          : "View details"}
      </Link>
    </article>
  );
}

function SubmissionPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-5"
      aria-label="Submission history pagination"
    >
      <button
        type="button"
        className={buttonVariants({ variant: "outline", size: "touch" })}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </button>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Page {currentPage} of {totalPages}
      </p>
      <button
        type="button"
        className={buttonVariants({ variant: "outline", size: "touch" })}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}

function SubmissionListSkeleton() {
  return (
    <Card className="divide-y divide-border py-0" aria-label="Loading submissions">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid gap-3 p-4 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-7 w-32 sm:justify-self-end" />
        </div>
      ))}
    </Card>
  );
}
