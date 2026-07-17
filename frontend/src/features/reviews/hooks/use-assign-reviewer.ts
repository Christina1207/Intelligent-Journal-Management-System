"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assignReviewer } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type { AssignReviewerPayload } from "@/features/reviews/types";

interface AssignReviewerVariables {
  submissionId: string;
  payload: AssignReviewerPayload;
}

export function useAssignReviewer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, payload }: AssignReviewerVariables) =>
      assignReviewer(submissionId, payload),

    onSuccess: async (_assignment, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewQueryKeys.sectionEditor(),
        }),
        queryClient.invalidateQueries({
          queryKey: [
            ...reviewQueryKeys.sectionEditor(),
            "submissions",
            variables.submissionId,
          ],
        }),
      ]);
    },
  });
}
