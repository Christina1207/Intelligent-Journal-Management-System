import type {
  DeskRejectPayload,
  ManagerManuscriptDownload,
  ManagerSubmissionDetail,
  TriageState,
  UpdateTriagePayload,
} from "@/features/workflow/types";
import { apiClient } from "@/lib/api/client";

export function getManagerSubmissionDetail(submissionId: string) {
  return apiClient.get<ManagerSubmissionDetail>(
    `/manager/submissions/${submissionId}/`,
  );
}

export function getTriageState(submissionId: string) {
  return apiClient.get<TriageState>(
    `/manager/submissions/${submissionId}/triage/`,
  );
}

export function updateTriageDraft(
  submissionId: string,
  payload: UpdateTriagePayload,
) {
  return apiClient.patch<TriageState>(
    `/manager/submissions/${submissionId}/triage/`,
    payload,
  );
}

export function completeTriage(submissionId: string) {
  return apiClient.post<TriageState>(
    `/manager/submissions/${submissionId}/triage/complete/`,
  );
}

export function deskRejectSubmission(
  submissionId: string,
  payload: DeskRejectPayload,
) {
  return apiClient.post<TriageState>(
    `/manager/submissions/${submissionId}/desk-reject/`,
    payload,
  );
}

export function getManagerManuscriptDownload(submissionId: string) {
  return apiClient.get<ManagerManuscriptDownload>(
    `/manager/submissions/${submissionId}/manuscript/`,
  );
}
