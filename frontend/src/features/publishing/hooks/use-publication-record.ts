"use client";

import { useQuery } from "@tanstack/react-query";

import { getPublicationRecord } from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";

export function usePublicationRecord(articleId: string) {
  return useQuery({
    queryKey: publishingQueryKeys.record(articleId),
    queryFn: () => getPublicationRecord(articleId),
  });
}
