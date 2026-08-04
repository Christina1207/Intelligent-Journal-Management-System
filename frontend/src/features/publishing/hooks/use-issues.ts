"use client";

import { useQuery } from "@tanstack/react-query";

import { getIssues } from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";

export function useIssues(enabled = true) {
  return useQuery({
    queryKey: publishingQueryKeys.issues(),
    queryFn: getIssues,
    enabled,
  });
}
