"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getReviewerCandidates,
  getReviewerRecommendations,
} from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";

interface UseReviewerCandidatesOptions {
  submissionId: string;
  search: string;
  limit?: number;
  enabled?: boolean;
}

export function useReviewerCandidates({
  submissionId,
  search,
  limit = 20,
  enabled = true,
}: UseReviewerCandidatesOptions) {
  return useQuery({
    queryKey: reviewQueryKeys.reviewerCandidates(
      submissionId,
      search.trim(),
      limit,
    ),
    queryFn: () => getReviewerCandidates(submissionId, search, limit),
    enabled: enabled && Boolean(submissionId),
    staleTime: 30_000,
  });
}

export function useReviewerRecommendations(
  submissionId: string,
  limit = 5,
  enabled = true,
) {
  return useQuery({
    queryKey: reviewQueryKeys.reviewerRecommendations(submissionId, limit),
    queryFn: () => getReviewerRecommendations(submissionId, limit),
    enabled: enabled && Boolean(submissionId),
    staleTime: 60_000,
  });
}
