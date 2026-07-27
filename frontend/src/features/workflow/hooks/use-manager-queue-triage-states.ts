"use client";

import { useQueries } from "@tanstack/react-query";

import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import { getTriageState } from "@/features/workflow/api/triage-api";
import type { TriageState } from "@/features/workflow/types";

export type QueueTriageQueryState = {
  data?: TriageState;
  isError: boolean;
  isPending: boolean;
};

export function useManagerQueueTriageStates(
  submissionIds: readonly string[],
) {
  const queries = useQueries({
    queries: submissionIds.map((submissionId) => ({
      queryKey: managerQueryKeys.triage(submissionId),
      queryFn: () => getTriageState(submissionId),
      staleTime: 60_000,
    })),
  });

  const bySubmissionId = new Map<string, QueueTriageQueryState>();

  submissionIds.forEach((submissionId, index) => {
    const query = queries[index];

    bySubmissionId.set(submissionId, {
      data: query?.data,
      isError: query?.isError ?? false,
      isPending: query?.isPending ?? true,
    });
  });

  return {
    bySubmissionId,
    isFetching: queries.some((query) => query.isFetching),
    isPending: queries.some((query) => query.isPending),
  };
}
