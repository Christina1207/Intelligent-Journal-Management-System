import { apiClient } from "@/lib/api/client";
import type {
  AuthorDashboardResponse,
  AuthorSubmissionsResponse,
  CreateSubmissionPayload,
  CreateSubmissionResponse,
  SubmissionDetail,
  SubmissionVersion,
} from "@/features/submissions/types";

export function getAuthorDashboard() {
  return apiClient.get<AuthorDashboardResponse>(
    "/submissions/author-dashboard/",
  );
}

export function getMySubmissions(page = 1) {
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

export function createSubmission(payload: CreateSubmissionPayload) {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("abstract", payload.abstract);
  formData.append("language", payload.language);
  formData.append("section", payload.section);
  formData.append("file", payload.file);

  if (payload.cover_letter?.trim()) {
    formData.append("cover_letter", payload.cover_letter.trim());
  }

  return apiClient.post<CreateSubmissionResponse>("/submissions/", formData);
}
