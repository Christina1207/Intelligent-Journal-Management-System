import type {
  SubmissionSectionSummary,
  SubmissionStatus,
  SubmissionTopic,
} from "@/features/submissions/types";
import type { UserRole } from "@/types/auth";
import type { PaginatedApiResponse } from "@/types/api";

export type ManagerQueueSection = SubmissionSectionSummary & {
  description: string;
  issn: string;
  is_active: boolean;
  created_at: string;
};

export type ManagerSubmissionListItem = {
  id: string;
  title: string;
  abstract: string;
  language: string;
  status: SubmissionStatus;
  section: ManagerQueueSection;
  topic: SubmissionTopic | null;
  submitted_at: string;
};

export type ManagerQueueSubmission = Omit<
  ManagerSubmissionListItem,
  "status"
> & {
  status: "SUBMITTED";
};

export type ManagerQueueResponse = PaginatedApiResponse<ManagerQueueSubmission>;

export type ManagerMonitoringStatus =
  | "ASSIGNED"
  | "UNDER_REVIEW"
  | "SUSPENDED"
  | "REVIEWED"
  | "UNDER_REVISION"
  | "REVISED";

export type ManagerAssignedEditor = {
  id: string;
  full_name: string;
  email: string;
  affiliation: string;
};

export type ManagerReviewProgress = {
  invitations_total: number;
  invitations_pending: number;
  invitations_accepted: number;
  invitations_declined: number;
  invitations_expired: number;
  reviews_submitted: number;
  overdue_invitations: number;
  overdue_reviews: number;
};

export type ManagerAttentionFlag =
  | "REVIEWER_INVITATIONS_NOT_STARTED"
  | "OVERDUE_REVIEWER_INVITATIONS"
  | "OVERDUE_REVIEWS"
  | "EDITOR_DECISION_PENDING"
  | "AUTHOR_REVISION_PENDING"
  | "REVISION_REVIEW_PENDING"
  | "CASE_SUSPENDED";

export type ManagerMonitoringSubmission = {
  id: string;
  title: string;
  status: ManagerMonitoringStatus;
  section: SubmissionSectionSummary;
  assigned_editor: ManagerAssignedEditor | null;
  submitted_at: string;
  latest_version_number: number | null;
  revision_round_count: number;
  review_progress: ManagerReviewProgress;
  attention_flags: ManagerAttentionFlag[];
};

export type ManagerMonitoringResponse =
  PaginatedApiResponse<ManagerMonitoringSubmission>;

export type TriageResult = "PASS" | "CONCERN" | "NOT_APPLICABLE";

export type TriageStatus = "NOT_STARTED" | "DRAFT" | "COMPLETED";

export type TriageOutcome = "PROCEED" | "DESK_REJECTED";

export type TriageRejectionReason =
  | "OUT_OF_SCOPE"
  | "INCOMPLETE"
  | "QUALITY"
  | "GUIDELINES"
  | "ETHICS"
  | "OTHER";

export type TriageCheck = {
  code: string;
  label: string;
  description: string;
  required: boolean;
  allow_not_applicable: boolean;
  result: TriageResult | null;
  note: string;
};

export type TriageCompletedBy = {
  id: string;
  full_name: string;
};

export type PlagiarismScreeningPlaceholder = {
  status: "NOT_AVAILABLE";
  report: null;
};

export type TriageState = {
  assessment_id: string | null;
  submission_id: string;
  version_id: string;
  checklist_version: number;
  status: TriageStatus;
  outcome: TriageOutcome | null;
  checks: TriageCheck[];
  internal_notes: string;
  rejection_reason: TriageRejectionReason | null;
  author_message: string;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  completed_by: TriageCompletedBy | null;
  plagiarism_screening: PlagiarismScreeningPlaceholder;
};

export type TriageCheckInput = {
  code: string;
  result: TriageResult;
  note?: string;
};

export type UpdateTriagePayload = {
  internal_notes?: string;
  checks?: TriageCheckInput[];
};

export type DeskRejectPayload = {
  reason_code: TriageRejectionReason;
  author_message: string;
};

export type EligibleEditor = {
  id: string;
  full_name: string;
  email: string;
  affiliation: string;
  active_assignment_count: number;
  is_current_editor: boolean;
};

export type AssignEditorPayload = {
  editor_id: string;
};

export type ManagerReassignmentReason =
  | "WORKLOAD"
  | "CONFLICT"
  | "INACTIVITY"
  | "UNAVAILABLE"
  | "ADMINISTRATIVE";

export type ReassignEditorPayload = {
  editor_id: string;
  reason: ManagerReassignmentReason;
};

export type ManagerAssignmentUser = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  orcid: string;
  affiliation: string;
  country: string;
  status: string;
  roles: Array<{
    id: number;
    name: UserRole;
  }>;
  reviewer_profile: unknown | null;
};

export type ManagerAssignmentResponse = {
  id: string;
  submission: ManagerSubmissionListItem;
  assigned_to: ManagerAssignmentUser;
  assigned_by: ManagerAssignmentUser | null;
  role: "SECTION_EDITOR";
  assignment_reason: "INITIAL" | ManagerReassignmentReason;
  created_at: string;
};
