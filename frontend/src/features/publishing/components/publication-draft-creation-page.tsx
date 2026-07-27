"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  FileOutput,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreatePublicationDraft } from "@/features/publishing/hooks";
import { useEditorReviewWorkspace } from "@/features/reviews/hooks";
import { getSubmissionDetail } from "@/features/submissions/api/submissions-api";
import { submissionQueryKeys } from "@/features/submissions/query-keys";

interface PublicationDraftCreationPageProps {
  submissionId: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The publication draft could not be created.";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PublicationDraftCreationPage({
  submissionId,
}: PublicationDraftCreationPageProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const workspaceQuery = useEditorReviewWorkspace(submissionId);
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.detail(submissionId),
    queryFn: () => getSubmissionDetail(submissionId),
  });
  const createDraft = useCreatePublicationDraft();

  if (workspaceQuery.isPending || submissionQuery.isPending) {
    return (
      <LoadingState
        label="Loading publishing handoff"
        className="min-h-[50vh]"
      />
    );
  }

  if (
    workspaceQuery.isError ||
    submissionQuery.isError ||
    !workspaceQuery.data ||
    !submissionQuery.data
  ) {
    const error = workspaceQuery.error ?? submissionQuery.error;

    return (
      <ErrorState
        title="Publishing handoff unavailable"
        description={
          error instanceof Error
            ? error.message
            : "The accepted submission could not be loaded."
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              Promise.all([
                workspaceQuery.refetch(),
                submissionQuery.refetch(),
              ])
            }
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const workspace = workspaceQuery.data;
  const submission = submissionQuery.data;
  const version = workspace.current_version;
  const draft = createDraft.data;
  const canCreateDraft =
    workspace.submission_status === "ACCEPTED" &&
    submission.status === "ACCEPTED" &&
    Boolean(version);

  const handleCreateDraft = async () => {
    try {
      await createDraft.mutateAsync(submissionId);
      setConfirmationOpen(false);
    } catch {
      // The mutation error remains visible in the confirmation dialog.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publishing handoff"
        title="Create publication draft"
        description={
          <>
            Transfer <span dir="auto">“{submission.title}”</span> into the
            internal publishing workflow. Draft creation does not publish the
            article.
          </>
        }
        breadcrumbs={
          <Link
            href={`/section-editor/submissions/${submissionId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Assigned manuscript
          </Link>
        }
      />

      {!canCreateDraft ? (
        <Notice
          title="Submission is not ready for publishing handoff"
          description="A publication draft requires the latest manuscript version and a final acceptance decision."
          tone="destructive"
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Accepted manuscript</CardTitle>
            <Badge variant="success">Accepted</Badge>
            {version ? (
              <Badge variant="outline">Version {version.version_number}</Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {version ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Source version</dt>
                <dd className="mt-1 font-medium">
                  Version {version.version_number}
                  {version.version_number === 1
                    ? " · Initial submission"
                    : ` · Revision round ${version.version_number - 1}`}
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">Version submitted</dt>
                <dd className="mt-1 font-medium">
                  <time dateTime={version.submitted_at}>
                    {formatDateTime(version.submitted_at)}
                  </time>
                </dd>
              </div>
            </dl>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>No accepted version available</AlertTitle>
              <AlertDescription>
                The manuscript version required for publishing could not be
                identified.
              </AlertDescription>
            </Alert>
          )}

          {!draft ? (
            <>
              {createDraft.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Draft not created</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(createDraft.error)}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Notice
                title="Draft contents"
                description="The accepted full manuscript, scholarly metadata, and author snapshot will be copied into an internal publication record. Public release remains a separate staff action."
                icon={FileOutput}
              />

              <Button
                type="button"
                disabled={!canCreateDraft || createDraft.isPending}
                onClick={() => {
                  createDraft.reset();
                  setConfirmationOpen(true);
                }}
              >
                <FileOutput aria-hidden="true" />
                Create publication draft
              </Button>
            </>
          ) : (
            <Notice
              title="Publication draft created"
              description={
                <>
                  Draft <span dir="auto">“{draft.title}”</span> was created from
                  version {version?.version_number}. Publishing staff can
                  continue from the internal draft record.
                </>
              }
              tone="success"
              icon={CheckCircle2}
              action={
                <Link
                  href="/section-editor/assignments"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Return to assignments
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!createDraft.isPending) {
            setConfirmationOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create this publication draft?</DialogTitle>
            <DialogDescription>
              The backend permits one publication record per accepted
              submission. This operation does not make the article public.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Duplicate drafts are blocked</AlertTitle>
            <AlertDescription>
              Confirm once. Repeated requests are rejected by the publishing
              service.
            </AlertDescription>
          </Alert>

          {createDraft.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Draft not created</AlertTitle>
              <AlertDescription>
                {getErrorMessage(createDraft.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={createDraft.isPending}
                />
              }
            >
              Return to manuscript
            </DialogClose>
            <Button
              type="button"
              disabled={createDraft.isPending || !canCreateDraft}
              onClick={handleCreateDraft}
            >
              <FileOutput aria-hidden="true" />
              {createDraft.isPending
                ? "Creating publication draft…"
                : "Confirm draft creation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
