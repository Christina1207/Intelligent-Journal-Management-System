"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  FileOutput,
  History,
  RefreshCw,
} from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeader } from "@/components/common/section-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ReviewRoundLabel,
} from "@/features/editorial/components";
import {
  EditorQueueStageBadge,
  EditorReviewProgressPanel,
  getEditorQueueStage,
  getEditorQueueStagePresentation,
  ReviewerDiscoveryPanel,
} from "@/features/reviews/components";
import { useEditorReviewWorkspace } from "@/features/reviews/hooks";
import {
  getSubmissionDetail,
  getSubmissionVersions,
} from "@/features/submissions/api/submissions-api";
import { SubmissionDecisionBadge } from "@/features/submissions/components/submission-decision-badge";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import {
  formatSubmissionDate,
  formatSubmissionLanguage,
} from "@/features/submissions/submission-formatters";
import { submissionQueryKeys } from "@/features/submissions/query-keys";
import type { SubmissionVersion } from "@/features/submissions/types";
import { ApiError } from "@/lib/api/errors";

type EditorManuscriptWorkspacePageProps = {
  submissionId: string;
};

function getWorkspaceError(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return {
      title: "Permission denied",
      description:
        "Only the currently assigned Section Editor can access this manuscript workspace.",
    };
  }

  if (error instanceof ApiError && error.status === 404) {
    return {
      title: "Editorial assignment not found",
      description:
        "This manuscript is not assigned to you, no longer exists, or has been reassigned.",
    };
  }

  return {
    title: "Manuscript workspace unavailable",
    description:
      error instanceof Error
        ? error.message
        : "The assigned manuscript could not be loaded.",
  };
}

function VersionHistoryItem({ version }: { version: SubmissionVersion }) {
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ReviewRoundLabel versionNumber={version.version_number} />
            <SubmissionDecisionBadge decision={version.decision} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted{" "}
            <time dateTime={version.submitted_at}>
              {formatSubmissionDate(version.submitted_at)}
            </time>
            {version.decided_at ? (
              <>
                {" "}
                · Decided{" "}
                <time dateTime={version.decided_at}>
                  {formatSubmissionDate(version.decided_at)}
                </time>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {version.full_manuscript_available ? (
            <Badge variant="outline">Full file stored</Badge>
          ) : null}
          {version.blinded_manuscript_available ? (
            <Badge variant="outline">Blinded file stored</Badge>
          ) : null}
        </div>
      </div>

      {version.response_to_reviewers ? (
        <details className="rounded-lg border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Author response to reviewers
          </summary>
          <p
            className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
            dir="auto"
          >
            {version.response_to_reviewers}
          </p>
        </details>
      ) : null}

      {version.decision_letter ? (
        <details className="rounded-lg border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Author-facing decision letter
          </summary>
          <p
            className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
            dir="auto"
          >
            {version.decision_letter}
          </p>
        </details>
      ) : null}
    </li>
  );
}

export function EditorManuscriptWorkspacePage({
  submissionId,
}: EditorManuscriptWorkspacePageProps) {
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.detail(submissionId),
    queryFn: () => getSubmissionDetail(submissionId),
  });
  const versionsQuery = useQuery({
    queryKey: submissionQueryKeys.versions(submissionId),
    queryFn: () => getSubmissionVersions(submissionId),
  });
  const workspaceQuery = useEditorReviewWorkspace(submissionId);

  const isPending =
    submissionQuery.isPending || workspaceQuery.isPending;

  if (isPending) {
    return (
      <LoadingState
        label="Loading assigned manuscript workspace"
        className="min-h-[50vh]"
      />
    );
  }

  const queryError =
    submissionQuery.error ?? workspaceQuery.error;

  if (queryError || !submissionQuery.data || !workspaceQuery.data) {
    const presentation = getWorkspaceError(queryError);

    return (
      <ErrorState
        title={presentation.title}
        description={presentation.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/section-editor/assignments"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft aria-hidden="true" />
              Back to assignments
            </Link>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                Promise.all([
                  submissionQuery.refetch(),
                  workspaceQuery.refetch(),
                  versionsQuery.refetch(),
                ])
              }
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        }
      />
    );
  }

  const submission = submissionQuery.data;
  const workspace = workspaceQuery.data;
  const versions = versionsQuery.data?.results ?? [];
  const stage = getEditorQueueStage(submission, workspace);
  const stagePresentation = getEditorQueueStagePresentation(stage);
  const canInvite = ["ASSIGNED", "UNDER_REVIEW"].includes(submission.status);
  const canCreateDraft = submission.status === "ACCEPTED";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Assigned manuscript"
        title={submission.title}
        description="Operate the current peer-review round using only actions permitted by the assigned-Editor backend policy."
        breadcrumbs={
          <Link
            href="/section-editor/assignments"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Peer-review assignments
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <SubmissionStatusBadge status={submission.status} />
            <EditorQueueStageBadge stage={stage} />
          </div>
        }
      />

      <Notice
        title={stagePresentation.actionLabel}
        description={stagePresentation.description}
        tone={
          stage === "OVERDUE"
            ? "destructive"
            : stage === "DECISION_REQUIRED"
              ? "success"
              : stage === "REVIEWER_SHORTAGE" ||
                  stage === "REVIEWER_SELECTION"
                ? "warning"
                : "info"
        }
      />

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Section</dt>
              <dd className="mt-1 font-medium">{submission.section.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Language</dt>
              <dd className="mt-1 font-medium">
                {formatSubmissionLanguage(submission.language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="mt-1 font-medium">
                <time dateTime={submission.submitted_at}>
                  {formatSubmissionDate(submission.submitted_at)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current round</dt>
              <dd className="mt-1">
                {workspace.current_version ? (
                  <ReviewRoundLabel
                    versionNumber={workspace.current_version.version_number}
                  />
                ) : (
                  "No version available"
                )}
              </dd>
            </div>
          </dl>

          <details className="rounded-lg border bg-muted/20 p-3">
            <summary className="cursor-pointer font-medium">
              Manuscript abstract
            </summary>
            <p
              className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
              dir="auto"
            >
              {submission.abstract}
            </p>
          </details>

          {submission.topic?.label || submission.topic?.keywords.length ? (
            <div>
              <p className="text-sm font-medium">Detected topic evidence</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {submission.topic.label ? (
                  <Badge variant="secondary">{submission.topic.label}</Badge>
                ) : null}
                {submission.topic.keywords.slice(0, 6).map((keyword) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {submission.status === "ASSIGNED" ? (
        <Notice
          title="Reviewer selection is the next backend-defined step"
          description="No separate Section Editor pre-review checklist is exposed by the repository. The Manager’s completed triage is not duplicated here."
          icon={BookOpenCheck}
        />
      ) : null}

      {workspace.current_version?.version_number &&
      workspace.current_version.version_number > 1 &&
      workspace.current_version.response_to_reviewers ? (
        <Notice
          title={`Revised version ${workspace.current_version.version_number} returned`}
          description={
            <p
              className="whitespace-pre-wrap"
              dir="auto"
            >
              {workspace.current_version.response_to_reviewers}
            </p>
          }
          tone="info"
        />
      ) : null}

      <section aria-labelledby="current-round-heading" className="space-y-4">
        <SectionHeader
          titleId="current-round-heading"
          title="Current review round"
          description="Invitation status, reviewer deadlines, submitted reports, confidential editor comments, and decision eligibility come directly from the Editor review workspace."
        />
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <EditorReviewProgressPanel submissionId={submissionId} />
        </div>
      </section>

      {canInvite && !workspace.can_make_decision ? (
        <section aria-labelledby="reviewer-selection-heading" className="space-y-4">
          <SectionHeader
            titleId="reviewer-selection-heading"
            title={
              workspace.progress.total_invitations === 0
                ? "Select reviewers"
                : "Add or replace reviewers"
            }
            description="Compare explainable recommendations with every currently eligible reviewer. Selection remains an explicit editorial decision."
          />
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <ReviewerDiscoveryPanel submission={submission} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="version-history-heading" className="space-y-4">
        <SectionHeader
          titleId="version-history-heading"
          title="Version and decision history"
          description="Previous manuscript versions and editorial decisions remain preserved. Historical confidential reviewer reports are not exposed by this endpoint."
          action={<History className="size-5 text-muted-foreground" aria-hidden="true" />}
        />

        {versionsQuery.isPending ? (
          <LoadingState label="Loading version history" className="min-h-40" />
        ) : versionsQuery.isError ? (
          <Notice
            title="Version history unavailable"
            description={
              versionsQuery.error instanceof Error
                ? versionsQuery.error.message
                : "The preserved manuscript history could not be loaded."
            }
            tone="warning"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => versionsQuery.refetch()}
              >
                <RefreshCw aria-hidden="true" />
                Retry history
              </Button>
            }
          />
        ) : versions.length === 0 ? (
          <Notice
            title="Version history unavailable"
            description="No manuscript versions were returned."
          />
        ) : (
          <ol className="divide-y overflow-hidden rounded-xl border bg-card">
            {versions.map((version) => (
              <VersionHistoryItem key={version.id} version={version} />
            ))}
          </ol>
        )}
      </section>

      {canCreateDraft ? (
        <Notice
          title="Accepted manuscript ready for publishing handoff"
          description="Create an internal publication draft from the latest accepted version. This does not publish the article."
          tone="success"
          icon={FileOutput}
          action={
            <Link
              href={`/section-editor/submissions/${submissionId}/publishing`}
              className={buttonVariants()}
            >
              Continue to publishing handoff
              <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
