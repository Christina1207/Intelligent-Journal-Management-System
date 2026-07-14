import type {
  AssignEditorPayload,
  EligibleEditor,
  ManagerAssignmentResponse,
  ManagerMonitoringResponse,
  ManagerMonitoringStatus,
  ManagerQueueResponse,
  ReassignEditorPayload,
} from "@/features/workflow/types";
import { apiClient } from "@/lib/api/client";

export function getManagerQueue(page = 1) {
  return apiClient.get<ManagerQueueResponse>(`/manager/queue/?page=${page}`);
}

export function getManagerMonitoring(
  page = 1,
  status?: ManagerMonitoringStatus,
) {
  const searchParams = new URLSearchParams({
    page: String(page),
  });

  if (status) {
    searchParams.set("status", status);
  }

  return apiClient.get<ManagerMonitoringResponse>(
    `/manager/monitoring/?${searchParams.toString()}`,
  );
}

export function getEligibleEditors(submissionId: string) {
  return apiClient.get<EligibleEditor[]>(
    `/manager/submissions/${submissionId}/eligible-editors/`,
  );
}

export function assignEditor(
  submissionId: string,
  payload: AssignEditorPayload,
) {
  return apiClient.post<ManagerAssignmentResponse>(
    `/manager/submissions/${submissionId}/assign-editor/`,
    payload,
  );
}

export function reassignEditor(
  submissionId: string,
  payload: ReassignEditorPayload,
) {
  return apiClient.post<ManagerAssignmentResponse>(
    `/manager/submissions/${submissionId}/reassign-editor/`,
    payload,
  );
}
