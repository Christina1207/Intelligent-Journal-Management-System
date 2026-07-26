"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  cancelReviewerAssignment,
  expireReviewerAssignment,
  replaceReviewerAssignment,
} from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type {
  CancelReviewerAssignmentPayload,
  ReplaceReviewerAssignmentPayload,
} from "@/features/reviews/types";

type AssignmentTarget = {
  assignmentId: string;
  submissionId: string;
};

type AssignmentVariables<TPayload> = AssignmentTarget & {
  payload: TPayload;
};

async function invalidateEditorSubmission(
  queryClient: QueryClient,
  submissionId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: reviewQueryKeys.sectionEditor(),
    }),
    queryClient.invalidateQueries({
      queryKey: reviewQueryKeys.editorReviewWorkspace(submissionId),
    }),
  ]);
}

export function useExpireReviewerAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
    }: AssignmentTarget) => expireReviewerAssignment(assignmentId),
    onSuccess: async (_response, variables) => {
      await invalidateEditorSubmission(queryClient, variables.submissionId);
    },
  });
}

export function useCancelReviewerAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: AssignmentVariables<CancelReviewerAssignmentPayload>) =>
      cancelReviewerAssignment(assignmentId, payload),
    onSuccess: async (_response, variables) => {
      await invalidateEditorSubmission(queryClient, variables.submissionId);
    },
  });
}

export function useReplaceReviewerAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: AssignmentVariables<ReplaceReviewerAssignmentPayload>) =>
      replaceReviewerAssignment(assignmentId, payload),
    onSuccess: async (_response, variables) => {
      await invalidateEditorSubmission(queryClient, variables.submissionId);
    },
  });
}
