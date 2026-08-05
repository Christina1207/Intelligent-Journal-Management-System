export const journalManagementQueryKeys = {
  all: ["journal-management"] as const,
  sections: () => [...journalManagementQueryKeys.all, "sections"] as const,
  managerCandidates: () =>
    [...journalManagementQueryKeys.all, "section-manager-candidates"] as const,
};
