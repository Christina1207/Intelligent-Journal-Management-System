export const publishingQueryKeys = {
  all: ["publishing"] as const,

  records: () => [...publishingQueryKeys.all, "records"] as const,

  recordList: (page: number) =>
    [...publishingQueryKeys.records(), page] as const,

  record: (articleId: string) =>
    [...publishingQueryKeys.all, "record", articleId] as const,
};
