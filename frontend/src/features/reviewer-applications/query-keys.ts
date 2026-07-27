export const reviewerApplicationQueryKeys = {
  all: ["reviewer-applications"] as const,

  own: () => [...reviewerApplicationQueryKeys.all, "own"] as const,

  sections: () => [...reviewerApplicationQueryKeys.all, "sections"] as const,
};
