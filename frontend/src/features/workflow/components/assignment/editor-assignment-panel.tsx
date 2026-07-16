"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, UserRoundPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getEligibleEditors } from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import {
  EditorAssignmentDialog,
  getWorkflowErrorMessage,
} from "@/features/workflow/components/assignment/editor-assignment-dialog";
import type { SubmissionStatus } from "@/features/submissions/types";

export function EditorAssignmentPanel({
  submissionId,
  submissionStatus,
}: {
  submissionId: string;
  submissionStatus: SubmissionStatus;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const editorsQuery = useQuery({
    queryKey: managerQueryKeys.eligibleEditors(submissionId),
    queryFn: () => getEligibleEditors(submissionId),
  });

  if (editorsQuery.isLoading) {
    return (
      <section
        aria-label="Loading editor assignment"
        aria-busy="true"
        className="h-52 animate-pulse rounded-xl bg-slate-200"
      />
    );
  }

  if (editorsQuery.isError) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-900">
          Could not load eligible editors
        </h2>
        <p className="mt-1 text-sm text-red-700">
          {getWorkflowErrorMessage(editorsQuery.error)}
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={() => void editorsQuery.refetch()}
          className="mt-4"
        >
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </section>
    );
  }

  const editors = editorsQuery.data ?? [];
  const currentEditor = editors.find((editor) => editor.is_current_editor);

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        {currentEditor ? (
          <CheckCircle2 aria-hidden="true" className="size-5 text-blue-700" />
        ) : (
          <UserRoundPlus aria-hidden="true" className="size-5 text-blue-700" />
        )}

        <h2 className="font-semibold text-slate-950">
          Section Editor assignment
        </h2>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {successMessage}
        </div>
      ) : null}

      {currentEditor ? (
        <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
          <p className="font-semibold text-slate-950">
            {currentEditor.full_name}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {currentEditor.affiliation || "No affiliation provided"}
          </p>
          <p className="mt-1 break-all text-xs text-slate-500">
            {currentEditor.email}
          </p>
          <p className="mt-3 text-xs font-medium text-slate-600">
            {currentEditor.active_assignment_count} active{" "}
            {currentEditor.active_assignment_count === 1
              ? "assignment"
              : "assignments"}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Reassignment is available from Active Manuscripts.
          </p>
        </div>
      ) : submissionStatus === "SUBMITTED" ? (
        <>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Triage is complete. Select an eligible Section Editor to continue
            editorial handling.
          </p>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setDialogOpen(true);
            }}
            className="mt-4 w-full"
          >
            <UserRoundPlus aria-hidden="true" />
            Assign Section Editor
          </Button>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This manuscript is no longer eligible for initial editor assignment.
        </p>
      )}

      {dialogOpen ? (
        <EditorAssignmentDialog
          open
          submissionId={submissionId}
          onOpenChange={setDialogOpen}
          onAssigned={(assignment) => {
            const fullName =
              `${assignment.assigned_to.first_name} ${assignment.assigned_to.last_name}`.trim();

            setSuccessMessage(
              fullName
                ? `${fullName} was assigned successfully.`
                : "The Section Editor was assigned successfully.",
            );
          }}
        />
      ) : null}
    </section>
  );
}
