"use client";

import { useMutation } from "@tanstack/react-query";

import { createPublicationDraft } from "@/features/publishing/api";

export function useCreatePublicationDraft() {
  return useMutation({
    mutationFn: (submissionId: string) => createPublicationDraft(submissionId),
  });
}
