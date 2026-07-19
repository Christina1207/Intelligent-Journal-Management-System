const INTELLIGENCE_QUERY_ROOT = ["intelligence"] as const;

export const intelligenceQueryKeys = {
  all: INTELLIGENCE_QUERY_ROOT,

  sectionTopics: [...INTELLIGENCE_QUERY_ROOT, "section-topics"] as const,
};
