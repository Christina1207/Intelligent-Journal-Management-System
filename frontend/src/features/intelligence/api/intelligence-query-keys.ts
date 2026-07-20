const INTELLIGENCE_QUERY_ROOT = ["intelligence"] as const;

export const intelligenceQueryKeys = {
  all: INTELLIGENCE_QUERY_ROOT,

  editorialDashboard: [
    ...INTELLIGENCE_QUERY_ROOT,
    "editorial-dashboard",
  ] as const,

  sectionTopics: [...INTELLIGENCE_QUERY_ROOT, "section-topics"] as const,
};
