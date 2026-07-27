"use client";

import * as React from "react";
import { RefreshCw, UserRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Notice } from "@/components/common/notice";
import { Badge } from "@/components/ui/badge";
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
  assignEditor,
  getEligibleEditors,
} from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import type {
  EligibleEditor,
  ManagerAssignmentResponse,
} from "@/features/workflow/types";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

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

export function getWorkflowErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return extractErrorDetail(error.details) ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function EditorSelectionList({
  editors,
  selectedEditorId,
  disabled,
  onSelect,
}: {
  editors: EligibleEditor[];
  selectedEditorId: string;
  disabled: boolean;
  onSelect: (editorId: string) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">Select a Section Editor</legend>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {editors.map((editor) => {
          const inputId = `editor-${editor.id}`;
          const selected = selectedEditorId === editor.id;
          const unavailable = editor.is_current_editor;

          return (
            <label
              key={editor.id}
              htmlFor={inputId}
              className={cn(
                "block rounded-lg border p-4 transition focus-within:ring-3 focus-within:ring-ring/35",
                unavailable
                  ? "cursor-not-allowed border-border/80 bg-muted/45 opacity-70"
                  : "cursor-pointer border-border/80 hover:border-primary/45 hover:bg-muted/35",
                selected &&
                  !unavailable &&
                  "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  id={inputId}
                  type="radio"
                  name="section-editor"
                  value={editor.id}
                  checked={selected}
                  disabled={unavailable}
                  onChange={() => onSelect(editor.id)}
                  className="mt-1 size-4 accent-primary"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground" dir="auto">
                      {editor.full_name}
                    </span>

                    {editor.is_current_editor ? (
                      <Badge variant="info">
                        Current editor
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm text-text-secondary" dir="auto">
                    {editor.affiliation || "No affiliation provided"}
                  </p>

                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {editor.email}
                  </p>

                  <p className="mt-3 text-xs font-medium text-foreground">
                    {editor.active_assignment_count} active{" "}
                    {editor.active_assignment_count === 1
                      ? "assignment"
                      : "assignments"}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EditorAssignmentDialog({
  open,
  submissionId,
  onOpenChange,
  onAssigned,
}: {
  open: boolean;
  submissionId: string;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (assignment: ManagerAssignmentResponse) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedEditorId, setSelectedEditorId] = React.useState("");
  const [selectionError, setSelectionError] = React.useState<string | null>(
    null,
  );
  const [apiError, setApiError] = React.useState<string | null>(null);

  const editorsQuery = useQuery({
    queryKey: managerQueryKeys.eligibleEditors(submissionId),
    queryFn: () => getEligibleEditors(submissionId),
    enabled: open,
  });

  const assignmentMutation = useMutation({
    mutationFn: () =>
      assignEditor(submissionId, {
        editor_id: selectedEditorId,
    }),
    onSuccess: async (assignment) => {
      setApiError(null);
      setSelectionError(null);

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

      onAssigned?.(assignment);
      onOpenChange(false);
    },
    onError: (error) => {
      setApiError(getWorkflowErrorMessage(error));
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEditorId) {
      setSelectionError("Select a Section Editor.");
      return;
    }

    setApiError(null);
    assignmentMutation.mutate();
  }

  const editors = editorsQuery.data ?? [];
  const assignableEditors = editors.filter(
    (editor) => !editor.is_current_editor,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!assignmentMutation.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign a Section Editor</DialogTitle>
          <DialogDescription>
            Select an eligible editor for this manuscript. Editors are ordered
            by their current active workload.
          </DialogDescription>
        </DialogHeader>

        {editorsQuery.isLoading ? (
          <div
            aria-label="Loading eligible editors"
            aria-busy="true"
            className="space-y-3"
          >
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
            title="Eligible editors could not be loaded"
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
        ) : assignableEditors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <UserRound
              aria-hidden="true"
              className="mx-auto size-7 text-muted-foreground"
            />
            <h3 className="mt-3 font-semibold text-foreground">
              No eligible editors
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No active Section Editor membership is available for this
              manuscript’s section.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {apiError ? (
              <Notice
                tone="destructive"
                title="Editor assignment could not be completed"
                description={apiError}
              />
            ) : null}

            <EditorSelectionList
              editors={editors}
              selectedEditorId={selectedEditorId}
              disabled={assignmentMutation.isPending}
              onSelect={(editorId) => {
                setSelectedEditorId(editorId);
                setSelectionError(null);
                setApiError(null);
              }}
            />
            {selectionError ? (
              <p
                className="text-xs font-medium text-destructive"
                role="alert"
              >
                {selectionError}
              </p>
            ) : null}

            <p className="text-xs leading-5 text-muted-foreground">
              Confirming creates an append-only assignment record and moves the
              manuscript to Assigned status.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={assignmentMutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="touch"
                disabled={!selectedEditorId || assignmentMutation.isPending}
              >
                {assignmentMutation.isPending
                  ? "Assigning editor…"
                  : "Confirm assignment"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
