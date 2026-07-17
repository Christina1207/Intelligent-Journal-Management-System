export const reviewQueryKeys = {
  all: ["reviews"] as const,

  reviewerAssignments: () =>
    [...reviewQueryKeys.all, "reviewer", "assignments"] as const,

  sectionEditor: () => [...reviewQueryKeys.all, "section-editor"] as const,

  sectionEditorQueue: (page: number) =>
    [...reviewQueryKeys.sectionEditor(), "queue", page] as const,

  reviewerCandidates: (submissionId: string, search: string, limit: number) =>
    [
      ...reviewQueryKeys.sectionEditor(),
      "submissions",
      submissionId,
      "reviewer-candidates",
      search,
      limit,
    ] as const,

  reviewerRecommendations: (submissionId: string, limit: number) =>
    [
      ...reviewQueryKeys.sectionEditor(),
      "submissions",
      submissionId,
      "reviewer-recommendations",
      limit,
    ] as const,
};
