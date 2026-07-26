"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { makeEditorDecision } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type { MakeEditorDecisionPayload } from "@/features/reviews/types";
import { submissionQueryKeys } from "@/features/submissions/query-keys";

interface MakeEditorDecisionVariables {
  submissionId: string;
  payload: MakeEditorDecisionPayload;
}

export function useMakeEditorDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, payload }: MakeEditorDecisionVariables) =>
      makeEditorDecision(submissionId, payload),

    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewQueryKeys.editorReviewWorkspace(
            variables.submissionId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: reviewQueryKeys.sectionEditor(),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.detail(variables.submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.versions(variables.submissionId),
        }),
      ]);
    },
  });
}
