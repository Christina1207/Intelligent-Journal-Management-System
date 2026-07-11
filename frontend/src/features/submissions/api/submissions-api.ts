import { apiClient } from "@/lib/api/client";
import type {
  AuthorDashboardResponse,
  AuthorSubmissionsResponse,
  SubmissionDetail,
  SubmissionVersion,
} from "@/features/submissions/types";

export function getAuthorDashboard() {
  return apiClient.get<AuthorDashboardResponse>(
    "/submissions/author-dashboard/",
  );
}

export function getMySubmissions(page: number) {
  return apiClient.get<AuthorSubmissionsResponse>(
    `/submissions/my/?page=${page}`,
  );
}

export function getSubmissionDetail(submissionId: string) {
  return apiClient.get<SubmissionDetail>(`/submissions/${submissionId}/`);
}

export function getSubmissionVersions(submissionId: string) {
  return apiClient.get<SubmissionVersion[]>(
    `/submissions/${submissionId}/versions/`,
  );
}
