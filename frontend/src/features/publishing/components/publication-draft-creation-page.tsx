"use client";

import Link from "next/link";
import { CheckCircle2, FileOutput, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreatePublicationDraft } from "@/features/publishing/hooks";
import { useEditorReviewWorkspace } from "@/features/reviews/hooks";

interface PublicationDraftCreationPageProps {
  submissionId: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The publication draft could not be created.";
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
  const workspaceQuery = useEditorReviewWorkspace(submissionId);
  const createDraft = useCreatePublicationDraft();

  if (workspaceQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Publishing handoff unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {workspaceQuery.error instanceof Error
              ? workspaceQuery.error.message
              : "The accepted submission could not be loaded."}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => workspaceQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const workspace = workspaceQuery.data;
  const version = workspace.current_version;
  const draft = createDraft.data;

  const handleCreateDraft = () => {
    const confirmed = window.confirm(
      "Create a publication draft from the accepted manuscript version?",
    );

    if (confirmed) {
      createDraft.mutate(submissionId);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/section-editor/assignments"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to editorial assignments
      </Link>

      <header className="rounded-xl border bg-card p-6">
        <p className="text-sm font-medium text-muted-foreground">
          Publishing handoff
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Create publication draft
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Transfer the accepted manuscript version into the publishing workflow.
          Creating a draft does not publish the article.
        </p>
      </header>

      {workspace.submission_status !== "ACCEPTED" ? (
        <Alert variant="destructive">
          <AlertTitle>Submission is not accepted</AlertTitle>
          <AlertDescription>
            A publication draft can only be created after the latest manuscript
            version receives an acceptance decision.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Accepted manuscript</CardTitle>
            <Badge variant="secondary">Accepted</Badge>
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
                  {formatDateTime(version.submitted_at)}
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

              <Alert>
                <FileOutput aria-hidden="true" />
                <AlertTitle>Draft creation</AlertTitle>
                <AlertDescription>
                  The accepted full manuscript, scholarly metadata, and author
                  snapshot will be copied into an internal publication draft.
                  Public release remains a separate, authorized publishing
                  action.
                </AlertDescription>
              </Alert>

              <Button
                type="button"
                disabled={
                  workspace.submission_status !== "ACCEPTED" ||
                  !version ||
                  createDraft.isPending
                }
                onClick={handleCreateDraft}
              >
                <FileOutput aria-hidden="true" />
                {createDraft.isPending
                  ? "Creating publication draft…"
                  : "Create publication draft"}
              </Button>
            </>
          ) : (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>Publication draft created</AlertTitle>
              <AlertDescription>
                Draft “{draft.title}” was created successfully from version{" "}
                {version?.version_number}. Its status is {draft.status}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
