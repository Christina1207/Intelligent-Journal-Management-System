import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import type {
  PaginatedResponse,
  ReviewerApplication,
  ReviewerApplicationPayload,
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
