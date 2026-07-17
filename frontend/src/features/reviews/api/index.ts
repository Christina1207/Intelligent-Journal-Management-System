import { apiClient } from "@/lib/api/client";
import type {
  RespondToReviewInvitationPayload,
  ReviewerAssignment,
  ReviewerManuscriptDownload,
  SubmittedReview,
  SubmitReviewPayload,
} from "@/features/reviews/types";

export function getReviewerAssignments() {
  return apiClient.get<ReviewerAssignment[]>("/reviewer/assignments/");
}

export function respondToReviewInvitation(
  assignmentId: string,
  payload: RespondToReviewInvitationPayload,
) {
  return apiClient.post<ReviewerAssignment>(
    `/reviewer/assignments/${assignmentId}/respond/`,
    payload,
  );
}

export function getReviewerManuscript(assignmentId: string) {
  return apiClient.get<ReviewerManuscriptDownload>(
    `/reviewer/assignments/${assignmentId}/manuscript/`,
  );
}

export function submitReview(
  assignmentId: string,
  payload: SubmitReviewPayload,
) {
  return apiClient.post<SubmittedReview>(
    `/reviewer/assignments/${assignmentId}/submit-review/`,
    payload,
  );
}
