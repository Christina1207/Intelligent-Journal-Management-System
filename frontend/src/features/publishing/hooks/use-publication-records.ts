"use client";

import { useQuery } from "@tanstack/react-query";

import { getPublicationRecords } from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";

export function usePublicationRecords(page: number) {
  return useQuery({
    queryKey: publishingQueryKeys.recordList(page),
    queryFn: () => getPublicationRecords(page),
  });
}
