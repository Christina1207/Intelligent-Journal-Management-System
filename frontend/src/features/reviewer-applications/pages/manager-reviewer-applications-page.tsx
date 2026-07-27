"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  approveReviewerApplication,
  getReviewerApplications,
  rejectReviewerApplication,
} from "@/features/reviewer-applications/api/reviewer-applications-api";
import {
  ReviewerApplicationDecisionDialog,
  type ReviewerApplicationDecisionMode,
} from "@/features/reviewer-applications/components/reviewer-application-decision-dialog";
import { reviewerApplicationQueryKeys } from "@/features/reviewer-applications/query-keys";
import type {
  ReviewerApplication,
  ReviewerApplicationListStatus,
  ReviewerApplicationStatus,
} from "@/features/reviewer-applications/types";
import { ApiError } from "@/lib/api/errors";

const EMPTY_APPLICATIONS: ReviewerApplication[] = [];

const statusPresentation: Record<
  ReviewerApplicationStatus,
  {
    label: string;
    variant: "info" | "success" | "danger";
  }
> = {
  PENDING: {
    label: "Pending",
    variant: "info",
  },
  APPROVED: {
    label: "Approved",
    variant: "success",
  },
  REJECTED: {
    label: "Rejected",
    variant: "danger",
  },
};

type DecisionTarget = {
  application: ReviewerApplication;
  mode: ReviewerApplicationDecisionMode;
};

function getApplicantName(application: ReviewerApplication) {
  return (
    application.applicant.full_name.trim() || application.applicant.username
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function matchesSearch(application: ReviewerApplication, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    getApplicantName(application),
    application.applicant.username,
    application.applicant.email,
    application.applicant.affiliation,
    application.applicant.country,
    application.applicant.orcid,
    application.section.name,
    application.biography,
    ...application.keywords,
  ];

  return searchableValues.some((value) =>
    value.toLocaleLowerCase().includes(normalizedSearch),
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "The reviewer application decision could not be recorded.";
}

export function ManagerReviewerApplicationsPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] =
    React.useState<ReviewerApplicationListStatus>("PENDING");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [decisionTarget, setDecisionTarget] =
    React.useState<DecisionTarget | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const applicationsQuery = useQuery({
    queryKey: reviewerApplicationQueryKeys.list(page, statusFilter),
    queryFn: () =>
      getReviewerApplications({
        page,
        status: statusFilter,
      }),
  });

  const applications = applicationsQuery.data?.results ?? EMPTY_APPLICATIONS;

  const filteredApplications = React.useMemo(
    () =>
      applications.filter((application) =>
        matchesSearch(application, searchTerm),
      ),
    [applications, searchTerm],
  );

  const decisionMutation = useMutation({
    mutationFn: async ({
      applicationId,
      mode,
      decisionNote,
    }: {
      applicationId: string;
      mode: ReviewerApplicationDecisionMode;
      decisionNote: string;
    }) => {
      if (mode === "approve") {
        return approveReviewerApplication(applicationId, {
          decision_note: decisionNote || undefined,
        });
      }

      return rejectReviewerApplication(applicationId, {
        decision_note: decisionNote,
      });
    },

    onSuccess: async (decidedApplication, variables) => {
      const applicantName = getApplicantName(decidedApplication);

      setDecisionTarget(null);
      setSuccessMessage(
        variables.mode === "approve"
          ? `${applicantName} has been approved as a reviewer.`
          : `${applicantName}'s application has been rejected.`,
      );

      await queryClient.invalidateQueries({
        queryKey: reviewerApplicationQueryKeys.lists(),
      });
    },
  });

  const hasPreviousPage = Boolean(applicationsQuery.data?.previous);
  const hasNextPage = Boolean(applicationsQuery.data?.next);
  const filtersActive = statusFilter !== "ALL" || Boolean(searchTerm.trim());

  function changePage(nextPage: number) {
    setSearchTerm("");
    setSuccessMessage(null);
    setPage(nextPage);
  }

  function changeStatus(nextStatus: ReviewerApplicationListStatus) {
    setStatusFilter(nextStatus);
    setSearchTerm("");
    setSuccessMessage(null);
    setPage(1);
  }

  function clearFilters() {
    setStatusFilter("ALL");
    setSearchTerm("");
    setSuccessMessage(null);
    setPage(1);
  }

  function openDecision(
    application: ReviewerApplication,
    mode: ReviewerApplicationDecisionMode,
  ) {
    decisionMutation.reset();
    setSuccessMessage(null);
    setDecisionTarget({
      application,
      mode,
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reviewer onboarding"
        title="Reviewer applications"
        description="Evaluate reviewer applicants for your managed section and maintain a qualified, section-specific reviewer pool."
      />

      {successMessage ? (
        <Notice tone="success" icon={CheckCircle2} title={successMessage} />
      ) : null}

      <section
        aria-label="Reviewer application filters"
        className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-xs md:grid-cols-[minmax(0,1fr)_16rem_auto] md:items-end"
      >
        <div>
          <label
            htmlFor="reviewer-application-search"
            className="text-sm font-medium text-foreground"
          >
            Search loaded applications
          </label>

          <div className="relative mt-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <Input
              id="reviewer-application-search"
              type="search"
              value={searchTerm}
              className="min-h-11 pl-9"
              placeholder="Name, email, affiliation, or expertise"
              aria-describedby="reviewer-application-search-scope"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reviewer-application-status"
            className="text-sm font-medium text-foreground"
          >
            Application status
          </label>

          <div className="mt-2">
            <Select
              id="reviewer-application-status"
              value={statusFilter}
              className="min-h-11"
              onChange={(event) =>
                changeStatus(
                  event.target.value as ReviewerApplicationListStatus,
                )
              }
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All statuses</option>
            </Select>
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
          id="reviewer-application-search-scope"
          className="text-xs leading-5 text-muted-foreground md:col-span-3"
        >
          Status filtering is applied by the API. Search applies to the
          applications loaded on the current page.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        <header className="flex flex-col gap-2 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Application queue
            </h2>

            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {applicationsQuery.data
                ? `${applicationsQuery.data.count} application${
                    applicationsQuery.data.count === 1 ? "" : "s"
                  } in this view`
                : "Loading reviewer applications"}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Page {page}
            {searchTerm.trim() ? ` · ${filteredApplications.length} shown` : ""}
            {applicationsQuery.isFetching && !applicationsQuery.isLoading
              ? " · Refreshing"
              : ""}
          </p>
        </header>

        {applicationsQuery.isLoading ? (
          <ReviewerApplicationQueueSkeleton />
        ) : applicationsQuery.isError ? (
          <div className="p-5">
            <ErrorState
              title="Could not load reviewer applications"
              description="Check your connection and try loading the application queue again."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void applicationsQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </Button>
              }
            />
          </div>
        ) : applications.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={
                statusFilter === "PENDING"
                  ? "No pending reviewer applications"
                  : "No applications in this view"
              }
              description={
                statusFilter === "PENDING"
                  ? "There are currently no reviewer applications awaiting a decision for your managed section."
                  : "No reviewer applications match the selected status."
              }
              action={
                <ShieldCheck
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
              }
            />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No applications match this search"
              description="Change the search term or clear the current filters."
              action={
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/80">
            {filteredApplications.map((application) => (
              <ReviewerApplicationQueueItem
                key={application.id}
                application={application}
                isDeciding={
                  decisionMutation.isPending &&
                  decisionTarget?.application.id === application.id
                }
                onApprove={() => openDecision(application, "approve")}
                onReject={() => openDecision(application, "reject")}
              />
            ))}
          </div>
        )}

        {applicationsQuery.data && applications.length > 0 ? (
          <nav
            aria-label="Reviewer application pagination"
            className="flex flex-col gap-3 border-t border-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-muted-foreground">Page {page}</p>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!hasPreviousPage || applicationsQuery.isFetching}
                onClick={() => changePage(Math.max(1, page - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>

              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!hasNextPage || applicationsQuery.isFetching}
                onClick={() => changePage(page + 1)}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </section>

      {decisionTarget ? (
        <ReviewerApplicationDecisionDialog
          key={`${decisionTarget.application.id}-${decisionTarget.mode}`}
          application={decisionTarget.application}
          mode={decisionTarget.mode}
          isPending={decisionMutation.isPending}
          apiError={
            decisionMutation.isError
              ? getErrorMessage(decisionMutation.error)
              : null
          }
          onOpenChange={(open) => {
            if (!open) {
              decisionMutation.reset();
              setDecisionTarget(null);
            }
          }}
          onConfirm={(decisionNote) =>
            decisionMutation.mutate({
              applicationId: decisionTarget.application.id,
              mode: decisionTarget.mode,
              decisionNote,
            })
          }
        />
      ) : null}
    </div>
  );
}

function ReviewerApplicationQueueItem({
  application,
  isDeciding,
  onApprove,
  onReject,
}: {
  application: ReviewerApplication;
  isDeciding: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const applicantName = getApplicantName(application);
  const presentation = statusPresentation[application.status];

  return (
    <article className="p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3
              className="font-heading text-lg font-semibold text-foreground"
              dir="auto"
            >
              {applicantName}
            </h3>

            <Badge variant={presentation.variant}>{presentation.label}</Badge>

            <Badge variant="secondary">{application.section.name}</Badge>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {application.applicant.email}
          </p>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Affiliation
              </dt>
              <dd className="mt-1 text-foreground">
                {application.applicant.affiliation}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Country
              </dt>
              <dd className="mt-1 text-foreground">
                {application.applicant.country}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                ORCID
              </dt>
              <dd className="mt-1 text-foreground">
                {application.applicant.orcid || "Not provided"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Submitted
              </dt>
              <dd className="mt-1 text-foreground">
                {formatDate(application.submitted_at)}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <p className="text-xs font-medium text-muted-foreground">
              Expertise keywords
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {application.keywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          <details className="mt-5 rounded-xl border border-border bg-muted/25">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground marker:text-muted-foreground">
              Review academic biography
            </summary>

            <div className="border-t border-border px-4 py-4">
              <p
                className="whitespace-pre-wrap text-sm leading-7 text-text-secondary"
                dir="auto"
              >
                {application.biography}
              </p>
            </div>
          </details>

          {application.status !== "PENDING" ? (
            <div className="mt-5 rounded-xl border border-border bg-muted/35 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Decision record
              </p>

              <p className="mt-2 text-sm text-foreground">
                Decided {formatDate(application.reviewed_at)}
                {application.reviewed_by
                  ? ` by ${
                      application.reviewed_by.full_name ||
                      application.reviewed_by.email
                    }`
                  : ""}
                .
              </p>

              {application.decision_note ? (
                <p
                  className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary"
                  dir="auto"
                >
                  {application.decision_note}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {application.status === "PENDING" ? (
          <div className="grid shrink-0 grid-cols-2 gap-2 xl:w-52 xl:grid-cols-1">
            <Button
              type="button"
              variant="accent"
              size="touch"
              disabled={isDeciding}
              onClick={onApprove}
            >
              <UserRoundCheck data-icon="inline-start" aria-hidden="true" />
              Approve
            </Button>

            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={isDeciding}
              className="text-destructive hover:text-destructive"
              onClick={onReject}
            >
              <XCircle data-icon="inline-start" aria-hidden="true" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            {application.status === "APPROVED" ? (
              <CheckCircle2
                className="size-5 text-status-success-foreground"
                aria-hidden="true"
              />
            ) : (
              <XCircle className="size-5 text-destructive" aria-hidden="true" />
            )}
            Decision complete
          </div>
        )}
      </div>
    </article>
  );
}

function ReviewerApplicationQueueSkeleton() {
  return (
    <div
      className="divide-y divide-border/80"
      role="status"
      aria-label="Loading reviewer applications"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-4 p-5">
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({
              length: 4,
            }).map((__, itemIndex) => (
              <div
                key={itemIndex}
                className="h-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}
