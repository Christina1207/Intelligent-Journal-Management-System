import type {
  SubmissionDecision,
  SubmissionStatus,
  SubmissionTopic,
} from "@/features/submissions/types";
import type { PaginatedApiResponse } from "@/types/api";

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

export type SectionEditorQueueSubmission = {
  id: string;
  title: string;
  abstract: string;
  language: string;
  status: SubmissionStatus;
  section: {
    id: string;
    name: string;
    slug: string;
  };
  topic: SubmissionTopic | null;
  submitted_at: string;
};

export type SectionEditorQueueResponse =
  PaginatedApiResponse<SectionEditorQueueSubmission>;

export type ReviewerCandidate = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  orcid: string;
  affiliation: string;
  country: string;
  keywords: string[];
  active_assignment_count: number;
};

export type ReviewerCandidateResponse = {
  submission_id: string;
  count: number;
  candidates: ReviewerCandidate[];
};

export type ReviewerRecommendation = {
  reviewer_id: string;
  full_name: string;
  email: string;
  affiliation: string;
  keywords: string[];
  biography_excerpt: string;
  similarity_score: number;
  keyword_overlap_score: number;
  recommendation_score: number;
  matched_keywords: string[];
  matched_author_keywords: string[];
  matched_topic_keywords: string[];
  active_assignment_count: number;
  has_reviewed_before: boolean;
  explanation: string;
};

export type ReviewerRecommendationResponse = {
  submission_id: string;
  count: number;
  recommendations: ReviewerRecommendation[];
};

export type AssignReviewerPayload = {
  reviewer_id: string;
  response_deadline: string;
  review_deadline: string;
};

export type AssignReviewersPayload = {
  reviewer_ids: string[];
  response_deadline: string;
  review_deadline: string;
};

export type AssignReviewersResponse = {
  count: number;
  assignments: ReviewerAssignment[];
};

export type EditorReview = {
  id: string;
  reviewer: {
    id: string;
    email: string;
    full_name: string;
  };
  recommendation: string;
  comments_for_author: string;
  comments_for_editor: string;
  submitted_at: string;
};

export type EditorReviewWorkspaceResponse = {
  submission_id: string;
  submission_status: SubmissionStatus;
  current_version: {
    id: string;
    version_number: number;
    submitted_at: string;
    decision: string;
    response_to_reviewers?: string;
  } | null;
  required_reviews: number;
  assignments: ReviewerAssignment[];
  reviews_available: boolean;
  reviews_unavailable_reason: string | null;
  reviews: EditorReview[];
  can_make_decision: boolean;
};

export type EditorDecision =
  | "ACCEPTED"
  | "REJECTED"
  | "MINOR_REVISION"
  | "MAJOR_REVISION";

export type MakeEditorDecisionPayload = {
  decision: EditorDecision;
  decision_letter: string;
};

export type EditorDecisionResponse = {
  submission_id: string;
  submission_status: SubmissionStatus;
  version: {
    id: string;
    version_number: number;
    decision: string;
    decision_letter: string;
    decided_at: string;
    decided_by: {
      id: string;
      email: string;
      full_name: string;
    };
  };
};
