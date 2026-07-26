import { apiClient } from "@/lib/api/client";
import type { PaginatedApiResponse } from "@/types/api";
import type {
  AuthorDashboardResponse,
  AuthorSubmissionsResponse,
  CreateSubmissionPayload,
  CreateSubmissionResponse,
  SubmissionDetail,
  SubmissionVersion,
  UploadRevisedManuscriptPayload,
  UploadRevisedManuscriptResponse,
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
  return apiClient.get<PaginatedApiResponse<SubmissionVersion>>(
    `/submissions/${submissionId}/versions/`,
  );
}

export function createSubmission(payload: CreateSubmissionPayload) {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("abstract", payload.abstract);
  formData.append("language", payload.language);
  formData.append("section", payload.section);
  formData.append("keywords", JSON.stringify(payload.keywords));
  formData.append("coauthors", JSON.stringify(payload.coauthors));
  formData.append("file", payload.file);
  formData.append("blinded_file", payload.blinded_file);

  if (payload.cover_letter?.trim()) {
    formData.append("cover_letter", payload.cover_letter.trim());
  }

  return apiClient.post<CreateSubmissionResponse>("/submissions/", formData);
}

export function uploadRevisedManuscript(
  submissionId: string,
  payload: UploadRevisedManuscriptPayload,
) {
  const formData = new FormData();

  formData.append("file", payload.file);
  formData.append("blinded_file", payload.blinded_file);

  formData.append(
    "response_to_reviewers",
    payload.response_to_reviewers.trim(),
  );

  return apiClient.post<UploadRevisedManuscriptResponse>(
    `/submissions/${submissionId}/versions/upload/`,
    formData,
  );
}
