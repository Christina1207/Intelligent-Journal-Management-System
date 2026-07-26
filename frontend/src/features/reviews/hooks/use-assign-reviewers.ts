"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assignReviewers } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type { AssignReviewersPayload } from "@/features/reviews/types";
import { submissionQueryKeys } from "@/features/submissions/query-keys";

interface AssignReviewersVariables {
  submissionId: string;
  payload: AssignReviewersPayload;
}

export function useAssignReviewers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, payload }: AssignReviewersVariables) =>
      assignReviewers(submissionId, payload),

    onSuccess: async (_response, variables) => {
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
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.detail(variables.submissionId),
        }),
      ]);
    },
  });
}
