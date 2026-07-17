import type { SubmissionDecision } from "@/features/submissions/types";

export type ReviewerAssignmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type ReviewRecommendation =
  | "ACCEPT"
  | "MINOR_REVISION"
  | "MAJOR_REVISION"
  | "REJECT";

export type ReviewerUserSummary = {
  id: string;
  email: string;
  full_name: string;
};

export type ReviewerSubmissionSummary = {
  id: string;
  title: string;
  abstract: string;
  language: string;
  section: string;
};

export type ReviewerSubmissionVersionSummary = {
  id: string;
  version_number: number;
  submitted_at: string;
  decision: SubmissionDecision;
  response_to_reviewers: string;
};

export type ReviewerAssignment = {
  id: string;
  submission: ReviewerSubmissionSummary;
  version: ReviewerSubmissionVersionSummary;
  reviewer: ReviewerUserSummary;
  status: ReviewerAssignmentStatus;
  response_deadline: string;
  review_deadline: string;
  assigned_at: string;
  is_overdue: boolean;
  review_submitted: boolean;
  can_respond: boolean;
  can_download_manuscript: boolean;
  can_submit_review: boolean;
  cancelled_at: string | null;
  cancellation_reason: string;
};

export type RespondToReviewInvitationPayload = {
  accept: boolean;
};

export type ReviewerManuscriptDownload = {
  assignment_id: string;
  submission_id: string;
  version_id: string;
  version_number: number;
  expires_in_seconds: number;
  manuscript_url: string;
};

export type SubmitReviewPayload = {
  recommendation: ReviewRecommendation;
  comments_for_author: string;
  comments_for_editor?: string;
};

export type SubmittedReview = {
  id: string;
  reviewer: ReviewerUserSummary;
  recommendation: string;
  comments_for_author: string;
  comments_for_editor: string;
  submitted_at: string;
};
