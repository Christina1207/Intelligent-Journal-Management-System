"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  FileCheck2,
  History,
  RefreshCw,
  UsersRound,
} from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeader } from "@/components/common/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSubmissionDetail,
  getSubmissionVersions,
} from "@/features/submissions/api/submissions-api";
import { AuthorReviewerFeedbackPanel } from "@/features/submissions/components/author-reviewer-feedback-panel";
import { RevisionUploadForm } from "@/features/submissions/components/revision-upload-form";
import { SubmissionDecisionBadge } from "@/features/submissions/components/submission-decision-badge";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { SubmissionStatusGuidance } from "@/features/submissions/components/submission-status-guidance";
import { VersionHistory } from "@/features/submissions/components/version-history";
import { submissionQueryKeys } from "@/features/submissions/query-keys";
import {
  formatSubmissionDate,
  formatSubmissionLanguage,
} from "@/features/submissions/submission-formatters";
import type { SubmissionDetail } from "@/features/submissions/types";
import { ApiError } from "@/lib/api/errors";

type SubmissionDetailPageProps = {
  submissionId: string;
};

export function SubmissionDetailPage({
  submissionId,
}: SubmissionDetailPageProps) {
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.detail(submissionId),
    queryFn: () => getSubmissionDetail(submissionId),
  });
  const versionsQuery = useQuery({
    queryKey: submissionQueryKeys.versions(submissionId),
    queryFn: () => getSubmissionVersions(submissionId),
  });

  if (submissionQuery.isLoading) {
    return <SubmissionDetailSkeleton />;
  }

  if (submissionQuery.isError) {
    return (
      <SubmissionDetailError
        error={submissionQuery.error}
        onRetry={() => submissionQuery.refetch()}
      />
    );
  }

  const submission = submissionQuery.data;

  if (!submission) {
    return null;
  }

  const versions = versionsQuery.data?.results ?? [];
  const canUploadRevision = submission.status === "UNDER_REVISION";
  const revisionFeedbackVersion = submission.latest_version
    ? (versions.find(
        (version) => version.id === submission.latest_version?.id,
      ) ?? null)
    : null;
  const submittedDate = formatSubmissionDate(submission.submitted_at);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Submission record"
        title={submission.title}
        breadcrumbs={
          <Link
            href="/author/submissions"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            My submissions
          </Link>
        }
        description={
          <>
            {submission.section.name}
            {submittedDate ? ` · Submitted ${submittedDate}` : ""}
          </>
        }
        actions={<SubmissionStatusBadge status={submission.status} />}
      />

      {submissionQuery.isFetching ? (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          Updating submission…
        </p>
      ) : null}

      <SubmissionStatusGuidance status={submission.status} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Abstract</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="whitespace-pre-line text-sm leading-7 text-text-secondary"
                dir="auto"
              >
                {submission.abstract}
              </p>

              {submission.keywords.length > 0 ? (
                <div className="mt-6 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    Author-provided keywords
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {submission.keywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="rounded-md"
                        dir="auto"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasMeaningfulTopic(submission) ? (
                <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Detected topic
                  </h3>
                  {submission.topic?.label ? (
                    <p className="mt-1 text-sm text-text-secondary" dir="auto">
                      {submission.topic.label}
                    </p>
                  ) : null}
                  {submission.topic?.keywords.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {submission.topic.keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="outline"
                          className="rounded-md"
                          dir="auto"
                        >
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {submission.coauthors.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UsersRound className="size-5 text-accent" aria-hidden="true" />
                  Additional authors
                </CardTitle>
                <CardDescription>
                  Co-authors recorded with this submission.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3 sm:grid-cols-2">
                  {[...submission.coauthors]
                    .sort((first, second) => first.order - second.order)
                    .map((coauthor) => (
                      <li
                        key={coauthor.id}
                        className="rounded-lg border border-border p-4"
                      >
                        <p className="font-medium text-foreground" dir="auto">
                          {coauthor.full_name}
                        </p>
                        <p className="mt-1 break-all text-sm text-text-secondary">
                          {coauthor.email}
                        </p>
                        {coauthor.affiliation ? (
                          <p
                            className="mt-2 text-sm text-muted-foreground"
                            dir="auto"
                          >
                            {coauthor.affiliation}
                          </p>
                        ) : null}
                        {coauthor.country ? (
                          <p
                            className="mt-1 text-xs text-muted-foreground"
                            dir="auto"
                          >
                            {coauthor.country}
                          </p>
                        ) : null}
                        {coauthor.orcid ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            ORCID {coauthor.orcid}
                          </p>
                        ) : null}
                      </li>
                    ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Submission metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm">
                <MetadataItem label="Section" value={submission.section.name} />
                <MetadataItem
                  label="Language"
                  value={formatSubmissionLanguage(submission.language)}
                />
                {submittedDate ? (
                  <MetadataItem label="Submitted" value={submittedDate} />
                ) : null}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Current status
                  </dt>
                  <dd className="mt-2">
                    <SubmissionStatusBadge status={submission.status} />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {submission.latest_version ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="size-4 text-accent" aria-hidden="true" />
                  Current version
                </CardTitle>
                <CardDescription>
                  Version {submission.latest_version.version_number}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <SubmissionDecisionBadge
                  decision={submission.latest_version.decision}
                />
                {formatSubmissionDate(submission.latest_version.submitted_at) ? (
                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {formatSubmissionDate(submission.latest_version.submitted_at)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      {canUploadRevision ? (
        <section
          id="revision-upload"
          aria-labelledby="revision-workspace-heading"
          className="scroll-mt-24 space-y-4"
        >
          <SectionHeader
            title="Prepare your revision"
            titleId="revision-workspace-heading"
            description="Review the released feedback before replacing the manuscript files."
          />
          {versionsQuery.isLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : versionsQuery.isError ? (
            <ErrorState
              title="Reviewer feedback unavailable"
              description="The revision form is held back until the author-visible feedback and version record can be loaded safely."
              action={
                <button
                  type="button"
                  className={buttonVariants({
                    variant: "outline",
                    size: "touch",
                  })}
                  onClick={() => versionsQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </button>
              }
            />
          ) : revisionFeedbackVersion ? (
            <>
              <AuthorReviewerFeedbackPanel version={revisionFeedbackVersion} />
              <RevisionUploadForm submissionId={submission.id} />
            </>
          ) : (
            <Notice
              tone="destructive"
              title="Revision record unavailable"
              description="The journal marked this submission for revision, but the corresponding author-visible version could not be identified. Try refreshing before uploading files."
            />
          )}
        </section>
      ) : null}

      {versionsQuery.isLoading ? (
        <VersionHistorySkeleton />
      ) : versionsQuery.isError ? (
        <section aria-labelledby="version-history-error-heading">
          <SectionHeader
            title="Version and decision history"
            titleId="version-history-error-heading"
            description="Manuscript versions and author-visible editorial records."
          />
          <ErrorState
            className="mt-4"
            title="Could not load version history"
            description="The submission loaded, but its version history could not be retrieved."
            action={
              <button
                type="button"
                className={buttonVariants({
                  variant: "outline",
                  size: "touch",
                })}
                onClick={() => versionsQuery.refetch()}
              >
                <RefreshCw aria-hidden="true" />
                Try again
              </button>
            }
          />
        </section>
      ) : (
        <VersionHistory versions={versions} />
      )}
    </div>
  );
}

function SubmissionDetailError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const status = error instanceof ApiError ? error.status : undefined;
  const isForbidden = status === 403;
  const isNotFound = status === 404;
  const title = isForbidden
    ? "You cannot view this submission"
    : isNotFound
      ? "Submission not found"
      : "Could not load submission";
  const description = isForbidden
    ? "This record is outside your author permissions."
    : isNotFound
      ? "The submission may have been removed or the link may be incorrect."
      : "Check your connection and try loading the submission again.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Submission record"
        title={title}
        breadcrumbs={
          <Link
            href="/author/submissions"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            My submissions
          </Link>
        }
      />
      <ErrorState
        title={title}
        description={description}
        action={
          !isForbidden && !isNotFound ? (
            <button
              type="button"
              className={buttonVariants({ variant: "outline", size: "touch" })}
              onClick={onRetry}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </button>
          ) : (
            <Link
              href="/author/submissions"
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              Back to submissions
            </Link>
          )
        }
      />
    </div>
  );
}

function hasMeaningfulTopic(submission: SubmissionDetail) {
  return Boolean(
    submission.topic?.label || submission.topic?.keywords.length,
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground" dir="auto">
        {value}
      </dd>
    </div>
  );
}

function SubmissionDetailSkeleton() {
  return (
    <div className="space-y-7" aria-label="Loading submission details">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full max-w-3xl" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

function VersionHistorySkeleton() {
  return (
    <section aria-label="Loading version history" className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" aria-hidden="true" />
          <Skeleton className="h-6 w-64" />
        </div>
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-56 w-full" />
    </section>
  );
}
