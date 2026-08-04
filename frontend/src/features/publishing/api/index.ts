import type {
  IssueManagementRecord,
  IssueWritePayload,
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

export function getIssues() {
  return apiClient.get<IssueManagementRecord[]>("/publishing/issues/");
}

export function createIssue(payload: IssueWritePayload) {
  return apiClient.post<IssueManagementRecord>("/publishing/issues/", payload);
}

export function updateIssue(issueId: string, payload: IssueWritePayload) {
  return apiClient.patch<IssueManagementRecord>(
    `/publishing/issues/${issueId}/`,
    payload,
  );
}

export function openIssue(issueId: string) {
  return apiClient.post<IssueManagementRecord>(
    `/publishing/issues/${issueId}/open/`,
  );
}

export function closeIssue(issueId: string) {
  return apiClient.post<IssueManagementRecord>(
    `/publishing/issues/${issueId}/close/`,
  );
}
