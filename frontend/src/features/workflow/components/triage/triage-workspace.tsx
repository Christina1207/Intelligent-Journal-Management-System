"use client";

import * as React from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import {
  completeTriage,
  deskRejectSubmission,
  getManagerManuscriptDownload,
  getManagerSubmissionDetail,
  getTriageState,
  updateTriageDraft,
} from "@/features/workflow/api/triage-api";
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
    return <TriageWorkspaceSkeleton />;
  }

  if (submissionQuery.isError || triageQuery.isError) {
    return (
      <WorkspaceError
        onRetry={() => {
          void submissionQuery.refetch();
          void triageQuery.refetch();
        }}
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

  const requiredChecksComplete = checks
    .filter((check) => check.required)
    .every(
      (check) =>
        check.result !== null &&
        !(check.result === "NOT_APPLICABLE" && !check.allow_not_applicable),
    );

  const hasConcern = checks.some((check) => check.result === "CONCERN");

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
    onSuccess: (nextTriage) => {
      storeTriageState(nextTriage);
      setFeedback({
        type: "success",
        message: "Triage completed. A Section Editor can now be assigned.",
      });
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

  function handleComplete() {
    const confirmed = window.confirm(
      "Complete this triage assessment? Once completed, the checklist and internal notes can no longer be edited.",
    );

    if (confirmed) {
      setFeedback(null);
      completeMutation.mutate();
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/manager/submissions"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to screening queue
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">
              Initial manuscript screening
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              {submission.title}
            </h1>
          </div>

          <SubmissionStatusBadge status={submission.status} />
        </div>

        <dl className="mt-5 grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
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
            label="Version"
            value={
              submission.latest_version
                ? `Version ${submission.latest_version.version_number}`
                : "No version"
            }
          />
        </dl>

        <div className="mt-5">
          <h2 className="text-sm font-semibold text-slate-950">Abstract</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
            {submission.abstract}
          </p>
        </div>

        <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Cover letter
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
            {submission.cover_letter.trim() || "No cover letter was provided."}
          </p>
        </details>
      </section>

      {triage.status === "COMPLETED" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 text-emerald-700"
            />
            <div>
              <h2 className="font-semibold text-emerald-900">
                Triage completed
              </h2>
              <p className="mt-1 text-sm text-emerald-700">
                {triage.outcome === "DESK_REJECTED"
                  ? "This manuscript was desk rejected. The assessment is now read-only."
                  : "This manuscript may proceed to Section Editor assignment. The assessment is now read-only."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={
            feedback.type === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              : "rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Triage checklist
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Checklist version {triage.checklist_version}
            </p>
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

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText aria-hidden="true" className="size-5 text-slate-600" />
              <h2 className="font-semibold text-slate-950">Manuscript PDF</h2>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Generate a short-lived secure link to inspect the latest
              manuscript version.
            </p>

            <Button
              type="button"
              variant="outline"
              disabled={
                !submission.latest_version?.manuscript_available ||
                downloadMutation.isPending
              }
              onClick={() => downloadMutation.mutate()}
              className="mt-4 w-full"
            >
              <Download aria-hidden="true" />
              {downloadMutation.isPending
                ? "Generating link..."
                : "Generate secure link"}
            </Button>

            {download ? (
              <a
                href={download.manuscript_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Open manuscript PDF
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Internal notes</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Editorial only. These notes are not shown to the author.
            </p>

            <Textarea
              value={internalNotes}
              maxLength={10000}
              disabled={isReadOnly || isBusy}
              onChange={(event) => {
                setInternalNotes(event.target.value);
                setFeedback(null);
              }}
              className="mt-3 min-h-36"
              placeholder="Record internal editorial observations."
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert
                aria-hidden="true"
                className="size-5 text-slate-500"
              />
              <h2 className="font-semibold text-slate-950">
                Plagiarism screening
              </h2>
            </div>

            <p className="mt-3 text-sm font-medium text-slate-600">
              Not available yet
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Plagiarism screening is not currently connected and does not block
              triage completion.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Triage actions</h2>

            {isReadOnly ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This assessment is complete and cannot be changed.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {hasChanges
                    ? "Save the current changes before completing or rejecting triage."
                    : !requiredChecksComplete
                      ? "Complete every required checklist item."
                      : hasConcern
                        ? "Resolve the concerns or desk reject the manuscript."
                        : "The saved assessment is ready to complete."}
                </p>

                <div className="mt-4 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasChanges || isBusy}
                    onClick={() => {
                      setFeedback(null);
                      saveMutation.mutate();
                    }}
                    className="w-full"
                  >
                    {saveMutation.isPending ? "Saving draft..." : "Save draft"}
                  </Button>

                  <Button
                    type="button"
                    disabled={!canComplete || isBusy}
                    onClick={handleComplete}
                    className="w-full"
                  >
                    {completeMutation.isPending
                      ? "Completing triage..."
                      : "Complete and proceed"}
                  </Button>

                  <Button
                    type="button"
                    disabled={!canDeskReject || isBusy}
                    onClick={() => {
                      setRejectApiError(null);
                      setRejectDialogOpen(true);
                    }}
                    className="w-full bg-red-600 text-white hover:bg-red-700"
                  >
                    Desk reject
                  </Button>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      {rejectDialogOpen ? (
        <DeskRejectDialog
          open
          isPending={rejectMutation.isPending}
          apiError={rejectApiError}
          onOpenChange={setRejectDialogOpen}
          onConfirm={(payload) => rejectMutation.mutate(payload)}
        />
      ) : null}
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function WorkspaceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 text-red-700"
        />
        <div>
          <h1 className="font-semibold text-red-900">
            Could not load the triage workspace
          </h1>
          <p className="mt-1 text-sm text-red-700">
            The manuscript or its triage assessment could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4"
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

function TriageWorkspaceSkeleton() {
  return (
    <div
      aria-label="Loading triage workspace"
      aria-busy="true"
      className="space-y-6"
    >
      <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="h-[720px] animate-pulse rounded-xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
