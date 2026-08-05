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
  const sections: ReviewerApplicationSection[] = [];
  let nextUrl: string | null = "/public/sections/";

  while (nextUrl) {
    const response:
      | ReviewerApplicationSection[]
      | PaginatedResponse<ReviewerApplicationSection> = await apiClient.get(
      nextUrl,
      {
        skipAuth: true,
      },
    );

    if (Array.isArray(response)) {
      sections.push(...response);
      break;
    }

    sections.push(...response.results);
    nextUrl = response.next;
  }

  return sections;
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
  sectionId,
}: {
  page: number;
  status: ReviewerApplicationListStatus;
  sectionId?: string;
}) {
  const query = new URLSearchParams({
    page: String(page),
  });

  if (status !== "ALL") {
    query.set("status", status);
  }

  if (sectionId) {
    query.set("section", sectionId);
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
