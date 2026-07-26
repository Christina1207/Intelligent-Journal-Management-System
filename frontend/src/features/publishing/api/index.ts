import type {
  PublicationDraft,
  PublicationRecord,
  PublicationRecordListResponse,
} from "@/features/publishing/types";
import { apiClient } from "@/lib/api/client";

export function createPublicationDraft(submissionId: string) {
  return apiClient.post<PublicationDraft>(
    `/publishing/submissions/${submissionId}/create-draft/`,
  );
}

export function getPublicationRecords(page: number) {
  return apiClient.get<PublicationRecordListResponse>(
    `/publishing/articles/?page=${page}`,
  );
}

export function getPublicationRecord(articleId: string) {
  return apiClient.get<PublicationRecord>(`/publishing/articles/${articleId}/`);
}

export function publishPublicationRecord(articleId: string) {
  return apiClient.post<PublicationRecord>(
    `/publishing/articles/${articleId}/publish/`,
  );
}
