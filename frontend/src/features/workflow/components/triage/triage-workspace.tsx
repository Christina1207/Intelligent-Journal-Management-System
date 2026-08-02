"use client";

import * as React from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Notice, type NoticeTone } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import { PlagiarismScreeningPanel } from "@/features/integrity/components/plagiarism-screening-panel";
import type { PlagiarismScreeningSummary } from "@/features/integrity/types";
import {
  completeTriage,
  deskRejectSubmission,
  getManagerManuscriptDownload,
  getManagerSubmissionDetail,
  getTriageState,
  updateTriageDraft,
} from "@/features/workflow/api/triage-api";
import { EditorAssignmentPanel } from "@/features/workflow/components/assignment/editor-assignment-panel";
import { CompleteTriageDialog } from "@/features/workflow/components/triage/complete-triage-dialog";
import { DeskRejectDialog } from "@/features/workflow/components/triage/desk-reject-dialog";
import { TriageChecklist } from "@/features/workflow/components/triage/triage-checklist";
import type {
  DeskRejectPayload,
  ManagerManuscriptDownload,
  ManagerSubmissionDetail,
  TriageCheck,
  TriageResult,
  TriageState,
} from "@/features/workflow/types";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLanguage(value: string) {
  return languageNames.of(value) ?? value.toUpperCase();
}

function extractErrorDetail(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractErrorDetail(item);
      if (message) return message;
    }
  }

  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      const message = extractErrorDetail(item);
      if (message) return message;
    }
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return extractErrorDetail(error.details) ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function getWorkspaceError(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    return {
      title: "Managed manuscript not found",
      description:
        "This manuscript does not exist or is outside the sections you manage.",
    };
  }

  if (error instanceof ApiError && error.status === 403) {
    return {
      title: "Triage access denied",
      description: "Your account is not permitted to manage this manuscript.",
    };
  }

  return {
    title: "Could not load the triage workspace",
    description: "The manuscript or its triage assessment could not be loaded.",
  };
}

export function TriageWorkspace({ submissionId }: { submissionId: string }) {
  const submissionQuery = useQuery({
    queryKey: managerQueryKeys.submission(submissionId),
    queryFn: () => getManagerSubmissionDetail(submissionId),
    refetchOnWindowFocus: false,
  });

  const triageQuery = useQuery({
    queryKey: managerQueryKeys.triage(submissionId),
    queryFn: () => getTriageState(submissionId),
    refetchOnWindowFocus: false,
  });

  if (submissionQuery.isLoading || triageQuery.isLoading) {
    return (
      <LoadingState label="Loading triage workspace" className="min-h-[55vh]" />
    );
  }

  if (submissionQuery.isError || triageQuery.isError) {
    const error = submissionQuery.error ?? triageQuery.error;
    const copy = getWorkspaceError(error);

    return (
      <ErrorState
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void submissionQuery.refetch();
                void triageQuery.refetch();
              }}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
            <Link
              href="/manager/submissions"
              className={buttonVariants({ variant: "ghost" })}
            >
              Return to queue
            </Link>
          </div>
        }
      />
    );
  }

  if (!submissionQuery.data || !triageQuery.data) {
    return null;
  }

  return (
    <TriageWorkspaceContent
      key={submissionQuery.data.id}
      submission={submissionQuery.data}
      triage={triageQuery.data}
    />
  );
}

function TriageWorkspaceContent({
  submission,
  triage,
}: {
  submission: ManagerSubmissionDetail;
  triage: TriageState;
}) {
  const queryClient = useQueryClient();
  const handleScreeningChange = React.useCallback(
    (nextScreening: PlagiarismScreeningSummary) => {
      queryClient.setQueryData<TriageState>(
        managerQueryKeys.triage(submission.id),
        (current) =>
          current
            ? {
                ...current,
                plagiarism_screening: nextScreening,
              }
            : current,
      );
    },
    [queryClient, submission.id],
  );
  const [checks, setChecks] = React.useState<TriageCheck[]>(() =>
    triage.checks.map((check) => ({ ...check })),
  );
  const [internalNotes, setInternalNotes] = React.useState(
    triage.internal_notes,
  );
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [rejectApiError, setRejectApiError] = React.useState<string | null>(
    null,
  );
  const [download, setDownload] =
    React.useState<ManagerManuscriptDownload | null>(null);

  const isReadOnly = triage.status === "COMPLETED";
  const hasChanges =
    internalNotes !== triage.internal_notes ||
    checks.some((check) => {
      const original = triage.checks.find(
        (candidate) => candidate.code === check.code,
      );

      return original?.result !== check.result || original?.note !== check.note;
    });
  const requiredChecks = checks.filter((check) => check.required);
  const answeredRequiredChecks = requiredChecks.filter(
    (check) =>
      check.result !== null &&
      !(check.result === "NOT_APPLICABLE" && !check.allow_not_applicable),
  ).length;
  const requiredChecksComplete =
    answeredRequiredChecks === requiredChecks.length;
  const concernCount = checks.filter(
    (check) => check.result === "CONCERN",
  ).length;
  const hasConcern = concernCount > 0;
  const isSaved = triage.assessment_id !== null && !hasChanges;
  const canComplete =
    !isReadOnly && isSaved && requiredChecksComplete && !hasConcern;
  const canDeskReject =
    !isReadOnly && isSaved && requiredChecksComplete && hasConcern;

  function storeTriageState(nextTriage: TriageState) {
    queryClient.setQueryData(
      managerQueryKeys.triage(submission.id),
      nextTriage,
    );
    setChecks(nextTriage.checks.map((check) => ({ ...check })));
    setInternalNotes(nextTriage.internal_notes);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const completedChecks = checks.filter(
        (
          check,
        ): check is TriageCheck & {
          result: TriageResult;
        } => check.result !== null,
      );

      return updateTriageDraft(submission.id, {
        internal_notes: internalNotes,
        checks: completedChecks.map((check) => ({
          code: check.code,
          result: check.result,
          note: check.note,
        })),
      });
    },
    onSuccess: (nextTriage) => {
      storeTriageState(nextTriage);
      setFeedback({
        type: "success",
        message: "Triage draft saved successfully.",
      });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: getErrorMessage(error),
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeTriage(submission.id),
    onSuccess: async (nextTriage) => {
      storeTriageState(nextTriage);
      setCompleteDialogOpen(false);
      setFeedback({
        type: "success",
        message: "Triage completed. A Section Editor can now be assigned.",
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.submission(submission.id),
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.queueRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.monitoringRoot,
        }),
      ]);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: getErrorMessage(error),
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: DeskRejectPayload) =>
      deskRejectSubmission(submission.id, payload),
    onSuccess: async (nextTriage) => {
      storeTriageState(nextTriage);
      setRejectDialogOpen(false);
      setRejectApiError(null);
      setFeedback({
        type: "success",
        message: "The manuscript was desk rejected.",
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.submission(submission.id),
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.queueRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.monitoringRoot,
        }),
      ]);
    },
    onError: (error) => {
      setRejectApiError(getErrorMessage(error));
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => getManagerManuscriptDownload(submission.id),
    onSuccess: (response) => {
      setDownload(response);
      setFeedback(null);
    },
    onError: (error) => {
      setDownload(null);
      setFeedback({
        type: "error",
        message: getErrorMessage(error),
      });
    },
  });

  const isBusy =
    saveMutation.isPending ||
    completeMutation.isPending ||
    rejectMutation.isPending;
  const guidance = getTriageGuidance({
    triage,
    hasChanges,
    requiredChecksComplete,
    hasConcern,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <Link
            href="/manager/submissions"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft aria-hidden="true" />
            Submitted queue
          </Link>
        }
        eyebrow="Initial manuscript screening"
        title={submission.title}
        description={
          <>
            {submission.section.name}
            <span aria-hidden="true"> · </span>
            Submitted {formatDate(submission.submitted_at)}
          </>
        }
        actions={<SubmissionStatusBadge status={submission.status} />}
      />

      <section
        aria-label="Manuscript metadata"
        className="grid overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetadataItem label="Section" value={submission.section.name} />
        <MetadataItem
          label="Language"
          value={formatLanguage(submission.language)}
        />
        <MetadataItem
          label="Submitted"
          value={formatDate(submission.submitted_at)}
        />
        <MetadataItem
          label="Current version"
          value={
            submission.latest_version
              ? `Version ${submission.latest_version.version_number}`
              : "No version available"
          }
        />
      </section>

      <Notice
        tone={guidance.tone}
        title={guidance.title}
        description={guidance.description}
      />

      {feedback ? (
        <Notice
          tone={feedback.type === "error" ? "destructive" : "success"}
          title={feedback.type === "error" ? "Action failed" : "Saved"}
          description={feedback.message}
        />
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Manuscript context
            </h2>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-foreground">
                Abstract
              </h3>
              <p
                className="mt-2 whitespace-pre-line text-sm leading-7 text-text-secondary"
                dir="auto"
              >
                {submission.abstract}
              </p>
            </div>

            <details className="mt-5 rounded-lg border border-border/80 bg-muted/35 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Cover letter
              </summary>
              <p
                className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary"
                dir="auto"
              >
                {submission.cover_letter.trim() ||
                  "No cover letter was provided."}
              </p>
            </details>
          </section>

          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Triage checklist
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Assess the current manuscript version using checklist version{" "}
                  {triage.checklist_version}.
                </p>
              </div>
              <Badge
                variant={
                  requiredChecksComplete && !hasConcern
                    ? "success"
                    : concernCount > 0
                      ? "warning"
                      : "outline"
                }
              >
                {answeredRequiredChecks} of {requiredChecks.length} required
                checks complete
              </Badge>
            </div>

            <TriageChecklist
              checks={checks}
              disabled={isReadOnly || isBusy}
              onChange={(nextChecks) => {
                setChecks(nextChecks);
                setFeedback(null);
              }}
            />
          </section>

          <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <h2 className="font-heading font-semibold text-foreground">
              Internal editorial notes
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These notes are restricted to the editorial workflow and are never
              included in the author-facing decision.
            </p>
            <label htmlFor="triage-internal-notes" className="sr-only">
              Internal editorial notes
            </label>
            <Textarea
              id="triage-internal-notes"
              dir="auto"
              value={internalNotes}
              maxLength={10000}
              disabled={isReadOnly || isBusy}
              onChange={(event) => {
                setInternalNotes(event.target.value);
                setFeedback(null);
              }}
              className="mt-4 min-h-36"
              placeholder="Record internal editorial observations."
            />
            <p className="mt-2 text-right text-xs text-muted-foreground">
              {internalNotes.length}/10,000
            </p>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          {triage.status === "COMPLETED" && triage.outcome === "PROCEED" ? (
            <EditorAssignmentPanel
              submissionId={submission.id}
              submissionStatus={submission.status}
            />
          ) : null}

          <TriageActionPanel
            triage={triage}
            hasChanges={hasChanges}
            requiredChecksComplete={requiredChecksComplete}
            concernCount={concernCount}
            canComplete={canComplete}
            canDeskReject={canDeskReject}
            isBusy={isBusy}
            isSaving={saveMutation.isPending}
            isCompleting={completeMutation.isPending}
            onSave={() => {
              setFeedback(null);
              saveMutation.mutate();
            }}
            onComplete={() => {
              setFeedback(null);
              setCompleteDialogOpen(true);
            }}
            onDeskReject={() => {
              setRejectApiError(null);
              setRejectDialogOpen(true);
            }}
          />

          <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <FileText
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              <h2 className="font-heading font-semibold text-foreground">
                Manuscript file
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Generate a secure ten-minute link for the latest manuscript
              version.
            </p>
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={
                !submission.latest_version?.manuscript_available ||
                downloadMutation.isPending
              }
              onClick={() => downloadMutation.mutate()}
              className="mt-4 w-full"
            >
              <Download aria-hidden="true" />
              {downloadMutation.isPending
                ? "Preparing secure link…"
                : "Prepare secure link"}
            </Button>
            {!submission.latest_version?.manuscript_available ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No manuscript file is available for the latest version.
              </p>
            ) : null}
            {download ? (
              <a
                href={download.manuscript_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ size: "touch" }),
                  "mt-3 w-full justify-center",
                )}
              >
                Open manuscript
                <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
          </section>

          <PlagiarismScreeningPanel
            submissionId={submission.id}
            language={submission.language}
            screening={triage.plagiarism_screening}
            onScreeningChange={handleScreeningChange}
          />
        </aside>
      </div>

      <CompleteTriageDialog
        open={completeDialogOpen}
        isPending={completeMutation.isPending}
        onOpenChange={setCompleteDialogOpen}
        onConfirm={() => completeMutation.mutate()}
      />

      <DeskRejectDialog
        open={rejectDialogOpen}
        isPending={rejectMutation.isPending}
        apiError={rejectApiError}
        onOpenChange={setRejectDialogOpen}
        onConfirm={(payload) => rejectMutation.mutate(payload)}
      />
    </div>
  );
}

function getTriageGuidance({
  triage,
  hasChanges,
  requiredChecksComplete,
  hasConcern,
}: {
  triage: TriageState;
  hasChanges: boolean;
  requiredChecksComplete: boolean;
  hasConcern: boolean;
}): { tone: NoticeTone; title: string; description: string } {
  if (triage.status === "COMPLETED") {
    return triage.outcome === "DESK_REJECTED"
      ? {
          tone: "destructive",
          title: "Desk rejection recorded",
          description:
            "This assessment is read-only and the manuscript is no longer eligible for editor assignment.",
        }
      : {
          tone: "success",
          title: "Ready for Section Editor assignment",
          description:
            "Initial triage is complete. Assign an eligible editor to move the manuscript into editorial handling.",
        };
  }

  if (hasChanges) {
    return {
      tone: "warning",
      title: "Unsaved triage changes",
      description:
        "Save the current checklist and notes before completing triage or opening desk rejection.",
    };
  }

  if (!requiredChecksComplete) {
    return {
      tone: "info",
      title: "Complete the required screening checks",
      description:
        "Every required checklist item needs a result before the assessment can be finalized.",
    };
  }

  if (hasConcern) {
    return {
      tone: "warning",
      title: "Screening concerns require a decision",
      description:
        "Resolve the concerns and save again, or use desk rejection with a clear author-facing reason.",
    };
  }

  return {
    tone: "success",
    title: "Saved assessment is ready to complete",
    description:
      "Review the checklist once more, then complete triage to enable Section Editor assignment.",
  };
}

function TriageActionPanel({
  triage,
  hasChanges,
  requiredChecksComplete,
  concernCount,
  canComplete,
  canDeskReject,
  isBusy,
  isSaving,
  isCompleting,
  onSave,
  onComplete,
  onDeskReject,
}: {
  triage: TriageState;
  hasChanges: boolean;
  requiredChecksComplete: boolean;
  concernCount: number;
  canComplete: boolean;
  canDeskReject: boolean;
  isBusy: boolean;
  isSaving: boolean;
  isCompleting: boolean;
  onSave: () => void;
  onComplete: () => void;
  onDeskReject: () => void;
}) {
  return (
    <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
      <h2 className="font-heading font-semibold text-foreground">
        Triage decision
      </h2>

      {triage.status === "COMPLETED" ? (
        <dl className="mt-4 space-y-3 text-sm">
          <RecordItem
            label="Outcome"
            value={
              triage.outcome === "PROCEED"
                ? "Proceed to editor assignment"
                : "Desk rejected"
            }
          />
          {triage.completed_by ? (
            <RecordItem
              label="Completed by"
              value={triage.completed_by.full_name}
            />
          ) : null}
          {triage.completed_at ? (
            <RecordItem
              label="Completed"
              value={formatDateTime(triage.completed_at)}
            />
          ) : null}
        </dl>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/45 p-3">
            <RecordItem
              label="Required checks"
              value={requiredChecksComplete ? "Complete" : "Incomplete"}
            />
            <RecordItem label="Concerns" value={String(concernCount)} />
          </dl>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {hasChanges
              ? "Save changes before choosing a final triage action."
              : !requiredChecksComplete
                ? "Complete every required checklist result."
                : concernCount > 0
                  ? "A saved concern enables desk rejection."
                  : "The saved assessment can now be completed."}
          </p>

          <div className="mt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={!hasChanges || isBusy}
              onClick={onSave}
              className="w-full"
            >
              <Save aria-hidden="true" />
              {isSaving ? "Saving draft…" : "Save draft"}
            </Button>
            <Button
              type="button"
              size="touch"
              disabled={!canComplete || isBusy}
              onClick={onComplete}
              className="w-full"
            >
              {isCompleting ? "Completing triage…" : "Complete and proceed"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              disabled={!canDeskReject || isBusy}
              onClick={onDeskReject}
              className="w-full"
            >
              Desk reject manuscript
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border/80 p-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 sm:[&:nth-child(3)]:border-l-0 xl:[&:nth-child(3)]:border-l">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground" dir="auto">
        {value}
      </dd>
    </div>
  );
}

function RecordItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground" dir="auto">
        {value}
      </dd>
    </div>
  );
}
