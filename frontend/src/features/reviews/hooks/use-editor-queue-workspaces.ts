"use client";

import { useQueries } from "@tanstack/react-query";

import { getEditorReviewWorkspace } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";
import type {
  EditorReviewWorkspaceResponse,
  SectionEditorQueueSubmission,
} from "@/features/reviews/types";

export type EditorQueueWorkspaceState = {
  data?: EditorReviewWorkspaceResponse;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
};

export function useEditorQueueWorkspaces(
  submissions: readonly SectionEditorQueueSubmission[],
) {
  const queries = useQueries({
    queries: submissions.map((submission) => ({
      queryKey: reviewQueryKeys.editorReviewWorkspace(submission.id),
      queryFn: () => getEditorReviewWorkspace(submission.id),
      staleTime: 30_000,
    })),
  });

  const states = new Map<string, EditorQueueWorkspaceState>();

  submissions.forEach((submission, index) => {
    const query = queries[index];

    states.set(submission.id, {
      data: query?.data,
      isError: query?.isError ?? false,
      isFetching: query?.isFetching ?? false,
      isPending: query?.isPending ?? true,
    });
  });

  return {
    states,
    isFetching: queries.some((query) => query.isFetching),
    isPending: queries.some((query) => query.isPending),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
