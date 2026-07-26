"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { publishPublicationRecord } from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";

export function usePublishPublicationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (articleId: string) =>
      publishPublicationRecord(articleId),

    onSuccess: (record) => {
      queryClient.setQueryData(
        publishingQueryKeys.record(record.id),
        record,
      );

      void queryClient.invalidateQueries({
        queryKey: publishingQueryKeys.records(),
      });
    },
  });
}