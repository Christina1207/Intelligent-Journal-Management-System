import type {
  PlagiarismScreeningDetail,
  PlagiarismScreeningSummary,
} from "@/features/integrity/types";
import { apiClient } from "@/lib/api/client";

export function requestPlagiarismScreening(submissionId: string) {
  return apiClient.post<PlagiarismScreeningSummary>(
    `/manager/submissions/${submissionId}/plagiarism-screenings/`,
  );
}

export function getPlagiarismScreeningDetail(screeningId: string) {
  return apiClient.get<PlagiarismScreeningDetail>(
    `/manager/plagiarism-screenings/${screeningId}/`,
  );
}
