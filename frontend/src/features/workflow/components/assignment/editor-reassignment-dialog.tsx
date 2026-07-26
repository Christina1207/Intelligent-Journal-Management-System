"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  const [formError, setFormError] = React.useState<string | null>(null);

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
      setFormError(null);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.eligibleEditors(submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.submission(submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: managerQueryKeys.monitoringRoot,
        }),
      ]);

      onOpenChange(false);
    },
    onError: (error) => {
      setFormError(getWorkflowErrorMessage(error));
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEditorId) {
      setFormError("Select a replacement Section Editor.");
      return;
    }

    if (!reason) {
      setFormError("Select a reassignment reason.");
      return;
    }

    setFormError(null);
    reassignmentMutation.mutate();
  }

  const editors = editorsQuery.data ?? [];
  const replacementEditors = editors.filter(
    (editor) => !editor.is_current_editor,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reassign Section Editor</DialogTitle>
          <DialogDescription>
            Replace the current editor while preserving the previous assignment
            in the manuscript’s audit history.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="line-clamp-2 text-sm font-medium text-slate-950">
            {submissionTitle}
          </p>
          <p className="mt-2 text-xs text-slate-500">Current Section Editor</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {currentEditor.full_name}
          </p>
        </div>

        {editorsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg bg-slate-200"
              />
            ))}
          </div>
        ) : editorsQuery.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <p className="text-sm text-red-700">
              {getWorkflowErrorMessage(editorsQuery.error)}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void editorsQuery.refetch()}
              className="mt-3"
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : replacementEditors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
            <p className="font-semibold text-slate-950">
              No replacement editor is available
            </p>
            <p className="mt-1 text-sm text-slate-500">
              The current editor is the only active eligible editor for this
              section.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError ? (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {formError}
              </div>
            ) : null}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Replacement editor
              </h3>

              <EditorSelectionList
                editors={editors}
                selectedEditorId={selectedEditorId}
                disabled={reassignmentMutation.isPending}
                onSelect={(editorId) => {
                  setSelectedEditorId(editorId);
                  setFormError(null);
                }}
              />
            </div>

            <div>
              <label
                htmlFor="reassignment-reason"
                className="text-sm font-medium text-slate-700"
              >
                Reassignment reason
              </label>

              <select
                id="reassignment-reason"
                value={reason}
                disabled={reassignmentMutation.isPending}
                onChange={(event) => {
                  setReason(
                    event.target.value as ManagerReassignmentReason | "",
                  );
                  setFormError(null);
                }}
                className="mt-2 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              >
                <option value="">Select a reason</option>

                {reassignmentReasons.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Reassignment changes only the current responsible editor. The
              manuscript remains in its existing workflow status.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={reassignmentMutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  !selectedEditorId || !reason || reassignmentMutation.isPending
                }
              >
                {reassignmentMutation.isPending
                  ? "Reassigning editor..."
                  : "Confirm reassignment"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
