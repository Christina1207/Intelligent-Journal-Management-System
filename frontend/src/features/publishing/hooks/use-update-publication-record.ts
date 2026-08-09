"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePublicationRecord } from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";
import type { PublicationUpdatePayload } from "@/features/publishing/types";

type UpdatePublicationRecordVariables = {
  articleId: string;
  payload: PublicationUpdatePayload;
};

export function useUpdatePublicationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ articleId, payload }: UpdatePublicationRecordVariables) =>
      updatePublicationRecord(articleId, payload),
    onSuccess: (record) => {
      queryClient.setQueryData(publishingQueryKeys.record(record.id), record);

      void queryClient.invalidateQueries({
        queryKey: publishingQueryKeys.records(),
      });
      void queryClient.invalidateQueries({
        queryKey: publishingQueryKeys.issues(),
      });
    },
  });
}
