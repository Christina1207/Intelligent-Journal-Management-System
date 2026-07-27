"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createPublicationDraft } from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import { submissionQueryKeys } from "@/features/submissions/query-keys";

export function useCreatePublicationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (submissionId: string) => createPublicationDraft(submissionId),
    onSuccess: async (_response, submissionId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: publishingQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: reviewQueryKeys.sectionEditor(),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.detail(submissionId),
        }),
      ]);
    },
  });
}
