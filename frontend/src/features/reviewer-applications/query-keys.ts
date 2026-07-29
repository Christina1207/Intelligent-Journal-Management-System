import type { ReviewerApplicationListStatus } from "@/features/reviewer-applications/types";

export const reviewerApplicationQueryKeys = {
  all: ["reviewer-applications"] as const,

  own: () => [...reviewerApplicationQueryKeys.all, "own"] as const,

  sections: () => [...reviewerApplicationQueryKeys.all, "sections"] as const,

  lists: () => [...reviewerApplicationQueryKeys.all, "list"] as const,

  list: (page: number, status: ReviewerApplicationListStatus) =>
    [...reviewerApplicationQueryKeys.lists(), page, status] as const,
};
