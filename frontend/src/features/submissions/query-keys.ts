export const submissionQueryKeys = {
  all: ["submissions"] as const,
  dashboard: () => [...submissionQueryKeys.all, "author-dashboard"] as const,
  lists: () => [...submissionQueryKeys.all, "author-lists"] as const,
  list: () => [...submissionQueryKeys.lists(), "all"] as const,
  details: () => [...submissionQueryKeys.all, "details"] as const,
  detail: (submissionId: string) =>
    [...submissionQueryKeys.details(), submissionId] as const,
  versions: (submissionId: string) =>
    [...submissionQueryKeys.detail(submissionId), "versions"] as const,
};
