"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getReviewerAssignments,
  getReviewerManuscript,
  respondToReviewInvitation,
  submitReview,
} from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type { SubmitReviewPayload } from "@/features/reviews/types";

export function useReviewerAssignments() {
  return useQuery({
    queryKey: reviewQueryKeys.reviewerAssignments,
    queryFn: getReviewerAssignments,
    staleTime: 30_000,
  });
}

export function useRespondToReviewInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      accept,
    }: {
      assignmentId: string;
      accept: boolean;
    }) => respondToReviewInvitation(assignmentId, { accept }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: reviewQueryKeys.reviewerAssignments,
      });
    },
  });
}

export function useReviewerManuscriptDownload() {
  return useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string }) =>
      getReviewerManuscript(assignmentId),
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: SubmitReviewPayload;
    }) => submitReview(assignmentId, payload),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: reviewQueryKeys.reviewerAssignments,
      });
    },
  });
}
