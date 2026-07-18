"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { makeEditorDecision } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type { MakeEditorDecisionPayload } from "@/features/reviews/types";

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
      ]);
    },
  });
}
