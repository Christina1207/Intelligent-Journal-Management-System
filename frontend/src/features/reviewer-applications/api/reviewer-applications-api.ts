import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import type {
  PaginatedResponse,
  ReviewerApplication,
  ReviewerApplicationApprovalPayload,
  ReviewerApplicationListStatus,
  ReviewerApplicationPayload,
  ReviewerApplicationRejectionPayload,
  ReviewerApplicationSection,
} from "@/features/reviewer-applications/types";

export async function getOwnReviewerApplication() {
  try {
    return await apiClient.get<ReviewerApplication>(
      "/auth/reviewer-application/",
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getReviewerApplicationSections() {
  const response = await apiClient.get<
    ReviewerApplicationSection[] | PaginatedResponse<ReviewerApplicationSection>
  >("/public/sections/", {
    skipAuth: true,
  });

  return Array.isArray(response) ? response : response.results;
}

export function submitReviewerApplication(payload: ReviewerApplicationPayload) {
  return apiClient.post<ReviewerApplication>(
    "/auth/reviewer-application/",
    payload,
  );
}

export function updateReviewerApplication(
  payload: Partial<ReviewerApplicationPayload>,
) {
  return apiClient.patch<ReviewerApplication>(
    "/auth/reviewer-application/",
    payload,
  );
}

export async function getReviewerApplications({
  page,
  status,
}: {
  page: number;
  status: ReviewerApplicationListStatus;
}) {
  const query = new URLSearchParams({
    page: String(page),
  });

  if (status !== "ALL") {
    query.set("status", status);
  }

  return apiClient.get<PaginatedResponse<ReviewerApplication>>(
    `/auth/reviewer-applications/?${query.toString()}`,
  );
}

export function approveReviewerApplication(
  applicationId: string,
  payload: ReviewerApplicationApprovalPayload,
) {
  return apiClient.post<ReviewerApplication>(
    `/auth/reviewer-applications/${applicationId}/approve/`,
    payload,
  );
}

export function rejectReviewerApplication(
  applicationId: string,
  payload: ReviewerApplicationRejectionPayload,
) {
  return apiClient.post<ReviewerApplication>(
    `/auth/reviewer-applications/${applicationId}/reject/`,
    payload,
  );
}
