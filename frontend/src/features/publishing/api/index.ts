import type { PublicationDraft } from "@/features/publishing/types";
import { apiClient } from "@/lib/api/client";

export function createPublicationDraft(submissionId: string) {
  return apiClient.post<PublicationDraft>(
    `/publishing/submissions/${submissionId}/create-draft/`,
  );
}
