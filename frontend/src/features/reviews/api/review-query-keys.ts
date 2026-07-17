const REVIEW_QUERY_ROOT = ["reviews"] as const;

export const reviewQueryKeys = {
  all: REVIEW_QUERY_ROOT,

  reviewerRoot: [...REVIEW_QUERY_ROOT, "reviewer"] as const,

  reviewerAssignments: [
    ...REVIEW_QUERY_ROOT,
    "reviewer",
    "assignments",
  ] as const,
};
