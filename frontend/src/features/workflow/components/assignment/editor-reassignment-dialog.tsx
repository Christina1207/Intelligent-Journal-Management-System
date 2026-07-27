"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  FormField,
  getFormFieldDescription,
} from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getEligibleEditors,
  reassignEditor,
} from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import {
  EditorSelectionList,
  getWorkflowErrorMessage,
} from "@/features/workflow/components/assignment/editor-assignment-dialog";
import type {
  ManagerAssignedEditor,
  ManagerReassignmentReason,
} from "@/features/workflow/types";

const reassignmentReasons: Array<{
  value: ManagerReassignmentReason;
  label: string;
}> = [
  { value: "WORKLOAD", label: "Workload balancing" },
  { value: "CONFLICT", label: "Conflict of interest" },
  { value: "INACTIVITY", label: "Editor inactivity" },
  { value: "UNAVAILABLE", label: "Editor unavailable" },
  { value: "ADMINISTRATIVE", label: "Administrative correction" },
];

export function EditorReassignmentDialog({
  open,
  submissionId,
  submissionTitle,
  currentEditor,
  onOpenChange,
}: {
  open: boolean;
  submissionId: string;
  submissionTitle: string;
  currentEditor: ManagerAssignedEditor;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedEditorId, setSelectedEditorId] = React.useState("");
  const [reason, setReason] = React.useState<ManagerReassignmentReason | "">(
    "",
  );
  const [validationErrors, setValidationErrors] = React.useState<{
    editor?: string;
    reason?: string;
  }>({});
  const [apiError, setApiError] = React.useState<string | null>(null);

  const editorsQuery = useQuery({
    queryKey: managerQueryKeys.eligibleEditors(submissionId),
    queryFn: () => getEligibleEditors(submissionId),
    enabled: open,
  });

  const reassignmentMutation = useMutation({
    mutationFn: () => {
      if (!reason) {
        throw new Error("Select a reassignment reason.");
      }

      return reassignEditor(submissionId, {
        editor_id: selectedEditorId,
        reason,
      });
    },
    onSuccess: async () => {
      setApiError(null);
      setValidationErrors({});

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.eligibleEditors(submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.submission(submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.queueRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.monitoringRoot,
        }),
      ]);

      onOpenChange(false);
    },
    onError: (error) => {
      setApiError(getWorkflowErrorMessage(error));
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = {
      editor: !selectedEditorId
        ? "Select a replacement Section Editor."
        : undefined,
      reason: !reason ? "Select a reassignment reason." : undefined,
    };

    setValidationErrors(nextErrors);

    if (nextErrors.editor || nextErrors.reason) {
      return;
    }

    setApiError(null);
    reassignmentMutation.mutate();
  }

  const editors = editorsQuery.data ?? [];
  const replacementEditors = editors.filter(
    (editor) => !editor.is_current_editor,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!reassignmentMutation.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reassign the Section Editor?</DialogTitle>
          <DialogDescription>
            Replace the current editor while preserving the previous assignment
            in the manuscript’s audit history.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/80 bg-muted/45 p-4">
          <p
            className="line-clamp-2 text-sm font-medium text-foreground"
            dir="auto"
          >
            {submissionTitle}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current Section Editor
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground" dir="auto">
            {currentEditor.full_name}
          </p>
        </div>

        {editorsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : editorsQuery.isError ? (
          <Notice
            tone="destructive"
            title="Replacement editors could not be loaded"
            description={getWorkflowErrorMessage(editorsQuery.error)}
            action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void editorsQuery.refetch()}
              className="mt-3"
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
            }
          />
        ) : replacementEditors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="font-semibold text-foreground">
              No replacement editor is available
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The current editor is the only active eligible editor for this
              section.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {apiError ? (
              <Notice
                tone="destructive"
                title="Reassignment could not be completed"
                description={apiError}
              />
            ) : null}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Replacement editor
              </h3>

              <EditorSelectionList
                editors={editors}
                selectedEditorId={selectedEditorId}
                disabled={reassignmentMutation.isPending}
                onSelect={(editorId) => {
                  setSelectedEditorId(editorId);
                  setValidationErrors((current) => ({
                    ...current,
                    editor: undefined,
                  }));
                  setApiError(null);
                }}
              />
              {validationErrors.editor ? (
                <p
                  className="mt-2 text-xs font-medium text-destructive"
                  role="alert"
                >
                  {validationErrors.editor}
                </p>
              ) : null}
            </div>

            <FormField
              htmlFor="reassignment-reason"
              label="Reassignment reason"
              required
              description="The reason is stored with the append-only assignment history."
              error={validationErrors.reason}
            >
              <select
                id="reassignment-reason"
                value={reason}
                disabled={reassignmentMutation.isPending}
                aria-invalid={Boolean(validationErrors.reason)}
                aria-describedby={getFormFieldDescription({
                  id: "reassignment-reason",
                  hasDescription: true,
                  hasError: Boolean(validationErrors.reason),
                })}
                onChange={(event) => {
                  setReason(
                    event.target.value as ManagerReassignmentReason | "",
                  );
                  setValidationErrors((current) => ({
                    ...current,
                    reason: undefined,
                  }));
                  setApiError(null);
                }}
                className="block min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
              >
                <option value="">Select a reason</option>

                {reassignmentReasons.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <Notice
              tone="warning"
              title="Editorial responsibility changes immediately"
              description="The current workflow status is preserved, and the previous assignment remains available in the audit history."
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={reassignmentMutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="touch"
                disabled={
                  !selectedEditorId || !reason || reassignmentMutation.isPending
                }
              >
                {reassignmentMutation.isPending
                  ? "Reassigning editor…"
                  : "Confirm reassignment"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
