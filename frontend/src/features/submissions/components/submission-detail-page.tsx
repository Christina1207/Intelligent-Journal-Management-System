"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import {
  getSubmissionDetail,
  getSubmissionVersions,
} from "@/features/submissions/api/submissions-api";
import { RevisionUploadForm } from "@/features/submissions/components/revision-upload-form";
import { SubmissionDecisionBadge } from "@/features/submissions/components/submission-decision-badge";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { VersionHistory } from "@/features/submissions/components/version-history";
import { AuthorReviewerFeedbackPanel } from "@/features/submissions/components/author-reviewer-feedback-panel";
type SubmissionDetailPageProps = {
  submissionId: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatLanguage(language: string) {
  const languageLabels: Record<string, string> = {
    en: "English",
    ar: "Arabic",
    fr: "French",
  };

  return languageLabels[language] ?? language.toUpperCase();
}

export function SubmissionDetailPage({
  submissionId,
}: SubmissionDetailPageProps) {
  const submissionQuery = useQuery({
    queryKey: ["submission-detail", submissionId],
    queryFn: () => getSubmissionDetail(submissionId),
  });

  const versionsQuery = useQuery({
    queryKey: ["submission-versions", submissionId],
    queryFn: () => getSubmissionVersions(submissionId),
  });

  if (submissionQuery.isLoading) {
    return <SubmissionDetailSkeleton />;
  }

  if (submissionQuery.isError) {
    return (
      <div className="space-y-6">
        <Link
          href="/author/submissions"
          className="text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          ← Back to submissions
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">
            Could not load submission
          </h1>
          <p className="mt-2 text-sm text-red-700">
            The submission may not exist, or you may not have permission to view
            it.
          </p>
        </div>
      </div>
    );
  }

  const submission = submissionQuery.data;

  if (!submission) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        Submission details are not available.
      </div>
    );
  }
  const versions = versionsQuery.data?.results ?? [];
  const latestVersion = submission.latest_version;
  const canUploadRevision = submission.status === "UNDER_REVISION";
  const revisionFeedbackVersion = latestVersion
    ? (versions.find((version) => version.id === latestVersion.id) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/author/submissions"
        className="text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        ← Back to submissions
      </Link>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">
              Submission details
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              {submission.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Submitted {formatDate(submission.submitted_at)}
            </p>
          </div>

          <SubmissionStatusBadge status={submission.status} />
        </div>
      </section>

      {canUploadRevision ? (
        versionsQuery.isLoading ? (
          <section
            className="h-48 animate-pulse rounded-xl bg-slate-200"
            aria-label="Loading reviewer feedback"
          />
        ) : versionsQuery.isError ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">
              Reviewer feedback unavailable
            </h2>
            <p className="mt-2 text-sm text-red-700">
              The revision form is temporarily unavailable because the reviewer
              feedback could not be loaded. Refresh the page before preparing
              the revision.
            </p>
          </section>
        ) : revisionFeedbackVersion ? (
          <>
            <AuthorReviewerFeedbackPanel version={revisionFeedbackVersion} />
            <RevisionUploadForm submissionId={submission.id} />
          </>
        ) : (
          <section className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">
              Revision version unavailable
            </h2>
            <p className="mt-2 text-sm text-red-700">
              The decided manuscript version could not be identified. Refresh
              the page before uploading a revision.
            </p>
          </section>
        )
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Abstract</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">
            {submission.abstract}
          </p>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-950">
              Author-provided keywords
            </h3>

            {submission.keywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {submission.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No author keywords were provided.
              </p>
            )}
          </div>
          {submission.topic ? (
            <div className="mt-6 rounded-lg border bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">
                Detected topic
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {submission.topic.label ?? "Unlabeled topic"}
              </p>

              {submission.topic.keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {submission.topic.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Manuscript metadata
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <MetadataItem label="Section" value={submission.section.name} />
              <MetadataItem
                label="Language"
                value={formatLanguage(submission.language)}
              />
              <MetadataItem
                label="Submitted"
                value={formatDate(submission.submitted_at)}
              />
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1">
                  <SubmissionStatusBadge status={submission.status} />
                </dd>
              </div>
            </dl>
          </section>
          {submission.coauthors.length > 0 ? (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Additional authors
              </h2>

              <div className="mt-5 space-y-4">
                {submission.coauthors.map((coauthor) => (
                  <article
                    key={coauthor.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <p className="font-medium text-slate-950">
                      {coauthor.order}. {coauthor.full_name}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {coauthor.email}
                    </p>

                    {coauthor.affiliation ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {coauthor.affiliation}
                      </p>
                    ) : null}

                    {coauthor.orcid ? (
                      <p className="mt-1 text-xs text-slate-500">
                        ORCID: {coauthor.orcid}
                      </p>
                    ) : null}

                    {coauthor.country ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {coauthor.country}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Latest decision
            </h2>

            {latestVersion ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm text-slate-500">
                    Version {latestVersion.version_number}
                  </p>
                  <div className="mt-2">
                    <SubmissionDecisionBadge
                      decision={latestVersion.decision}
                    />
                  </div>
                </div>

                <p className="text-sm text-slate-500">
                  Submitted {formatDate(latestVersion.submitted_at)}
                </p>

                {latestVersion.decision_letter ? (
                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">
                      Decision letter
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                      {latestVersion.decision_letter}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No decision letter has been recorded yet.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                No manuscript version is available for this submission.
              </p>
            )}
          </section>
        </aside>
      </section>

      {versionsQuery.isLoading ? (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 space-y-3">
            <div className="h-20 animate-pulse rounded bg-slate-200" />
            <div className="h-20 animate-pulse rounded bg-slate-200" />
          </div>
        </section>
      ) : versionsQuery.isError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">
            Could not load version history
          </h2>
          <p className="mt-2 text-sm text-red-700">
            The submission details loaded, but version history could not be
            retrieved.
          </p>
        </section>
      ) : (
        <VersionHistory versions={versions} />
      )}
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value}</dd>
    </div>
  );
}

function SubmissionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-36 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
