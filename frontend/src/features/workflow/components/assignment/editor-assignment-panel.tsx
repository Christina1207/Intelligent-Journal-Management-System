"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, UserRoundPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Notice } from "@/components/common/notice";
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
        className="h-52 animate-pulse rounded-xl bg-muted"
      />
    );
  }

  if (editorsQuery.isError) {
    return (
      <Notice
        tone="destructive"
        title="Could not load eligible editors"
        description={getWorkflowErrorMessage(editorsQuery.error)}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void editorsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const editors = editorsQuery.data ?? [];
  const currentEditor = editors.find((editor) => editor.is_current_editor);

  return (
    <section className="rounded-xl border border-status-info-border bg-status-info-subtle p-5 shadow-xs">
      <div className="flex items-center gap-2">
        {currentEditor ? (
          <CheckCircle2
            aria-hidden="true"
            className="size-5 text-status-info-foreground"
          />
        ) : (
          <UserRoundPlus
            aria-hidden="true"
            className="size-5 text-status-info-foreground"
          />
        )}

        <h2 className="font-heading font-semibold text-foreground">
          Section Editor assignment
        </h2>
      </div>

      {successMessage ? (
        <Notice
          tone="success"
          title="Section Editor assigned"
          description={successMessage}
          className="mt-4"
        />
      ) : null}

      {currentEditor ? (
        <div className="mt-4 rounded-lg border border-status-info-border bg-card p-4">
          <p className="font-semibold text-foreground" dir="auto">
            {currentEditor.full_name}
          </p>
          <p className="mt-1 text-sm text-text-secondary" dir="auto">
            {currentEditor.affiliation || "No affiliation provided"}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {currentEditor.email}
          </p>
          <p className="mt-3 text-xs font-medium text-foreground">
            {currentEditor.active_assignment_count} active{" "}
            {currentEditor.active_assignment_count === 1
              ? "assignment"
              : "assignments"}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Reassignment is available from Active Manuscripts.
          </p>
        </div>
      ) : submissionStatus === "SUBMITTED" ? (
        <>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Triage is complete. Select an eligible Section Editor to continue
            editorial handling.
          </p>

          <Button
            type="button"
            size="touch"
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
        <p className="mt-3 text-sm leading-6 text-text-secondary">
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
