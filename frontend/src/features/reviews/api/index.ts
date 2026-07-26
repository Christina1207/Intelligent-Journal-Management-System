import { apiClient } from "@/lib/api/client";
import type {
  RespondToReviewInvitationPayload,
  ReviewerAssignment,
  ReviewerManuscriptDownload,
  SubmittedReview,
  SubmitReviewPayload,
  AssignReviewerPayload,
  ReviewerCandidateResponse,
  ReviewerRecommendationResponse,
  SectionEditorQueueResponse,
  AssignReviewersPayload,
  AssignReviewersResponse,
  EditorReviewWorkspaceResponse,
  EditorDecisionResponse,
  MakeEditorDecisionPayload,
  CancelReviewerAssignmentPayload,
  ReplaceReviewerAssignmentPayload,
  ReplaceReviewerAssignmentResponse,
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
export function getSectionEditorQueue(page = 1) {
  return apiClient.get<SectionEditorQueueResponse>(
    `/editor/queue/?page=${page}`,
  );
}

export function getReviewerCandidates(
  submissionId: string,
  search = "",
  limit = 20,
) {
  const searchParams = new URLSearchParams({
    search: search.trim(),
    limit: String(limit),
  });

  return apiClient.get<ReviewerCandidateResponse>(
    `/editor/submissions/${submissionId}/reviewer-candidates/?${searchParams.toString()}`,
  );
}

export function getReviewerRecommendations(submissionId: string, limit = 5) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
  });

  return apiClient.get<ReviewerRecommendationResponse>(
    `/editor/submissions/${submissionId}/reviewer-recommendations/?${searchParams.toString()}`,
  );
}

export function assignReviewer(
  submissionId: string,
  payload: AssignReviewerPayload,
) {
  return apiClient.post<ReviewerAssignment>(
    `/editor/submissions/${submissionId}/assign-reviewer/`,
    payload,
  );
}

export function assignReviewers(
  submissionId: string,
  payload: AssignReviewersPayload,
) {
  return apiClient.post<AssignReviewersResponse>(
    `/editor/submissions/${submissionId}/assign-reviewers/`,
    payload,
  );
}

export function getEditorReviewWorkspace(submissionId: string) {
  return apiClient.get<EditorReviewWorkspaceResponse>(
    `/editor/submissions/${submissionId}/reviews/`,
  );
}

export function makeEditorDecision(
  submissionId: string,
  payload: MakeEditorDecisionPayload,
) {
  return apiClient.post<EditorDecisionResponse>(
    `/editor/submissions/${submissionId}/decision/`,
    payload,
  );
}

export function expireReviewerAssignment(assignmentId: string) {
  return apiClient.post<ReviewerAssignment>(
    `/editor/assignments/${assignmentId}/expire/`,
  );
}

export function cancelReviewerAssignment(
  assignmentId: string,
  payload: CancelReviewerAssignmentPayload,
) {
  return apiClient.post<ReviewerAssignment>(
    `/editor/assignments/${assignmentId}/cancel/`,
    payload,
  );
}

export function replaceReviewerAssignment(
  assignmentId: string,
  payload: ReplaceReviewerAssignmentPayload,
) {
  return apiClient.post<ReplaceReviewerAssignmentResponse>(
    `/editor/assignments/${assignmentId}/replace/`,
    payload,
  );
}
