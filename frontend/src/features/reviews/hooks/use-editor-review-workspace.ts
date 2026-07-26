"use client";

import { useQuery } from "@tanstack/react-query";

import { getEditorReviewWorkspace } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";

export function useEditorReviewWorkspace(submissionId: string, enabled = true) {
  return useQuery({
    queryKey: reviewQueryKeys.editorReviewWorkspace(submissionId),
    queryFn: () => getEditorReviewWorkspace(submissionId),
    enabled: enabled && Boolean(submissionId),
  });
}
