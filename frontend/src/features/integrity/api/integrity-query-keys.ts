const INTEGRITY_QUERY_ROOT = ["integrity"] as const;

export const integrityQueryKeys = {
  all: INTEGRITY_QUERY_ROOT,

  plagiarismScreeningsRoot: [
    ...INTEGRITY_QUERY_ROOT,
    "plagiarism-screenings",
  ] as const,

  plagiarismScreening: (screeningId: string) =>
    [...INTEGRITY_QUERY_ROOT, "plagiarism-screenings", screeningId] as const,
};
