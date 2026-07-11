import type { PaginatedApiResponse } from "@/types/api";

export type SubmissionStatus =
  | "SUBMITTED"
  | "ASSIGNED"
  | "UNDER_REVIEW"
  | "SUSPENDED"
  | "REVIEWED"
  | "UNDER_REVISION"
  | "REVISED"
  | "ACCEPTED"
  | "REJECTED";

export type SubmissionDecision =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "MAJOR_REVISION"
  | "MINOR_REVISION";

export type SubmissionTopic = {
  label: string | null;
  keywords: string[];
};

export type SubmissionSectionSummary = {
  id: string;
  name: string;
  slug: string;
};

export type SubmissionDetail = {
  id: string;
  title: string;
  abstract: string;
  language: string;
  status: SubmissionStatus;
  section: SubmissionSectionSummary;
  topic: SubmissionTopic | null;
  submitted_at: string;
  latest_version: null | {
    id: string;
    version_number: number;
    decision: SubmissionDecision;
    decision_letter: string;
    submitted_at: string;
  };
};

export type AuthorDashboardSubmission = {
  id: string;
  title: string;
  status: SubmissionStatus;
  section: string;
  submitted_at: string;
};

export type AuthorDashboardActionItem = AuthorDashboardSubmission & {
  action: "UPLOAD_REVISION";
};

export type AuthorDashboardResponse = {
  summary: {
    total: number;
    active: number;
    needs_revision: number;
    accepted: number;
    rejected: number;
  };
  action_required: AuthorDashboardActionItem[];
  recent_submissions: AuthorDashboardSubmission[];
};

export type AuthorSubmissionListItem = {
  id: string;
  title: string;
  abstract: string;
  language: string;
  status: SubmissionStatus;
  section: SubmissionSectionSummary;
  topic: SubmissionTopic | null;
  submitted_at: string;
};

export type AuthorSubmissionsResponse =
  PaginatedApiResponse<AuthorSubmissionListItem>;

export type SubmissionVersion = {
  id: string;
  version_number: number;
  file: string;
  submitted_at: string;
  decision: SubmissionDecision;
  decision_letter: string;
  decided_at: string | null;
  decided_by: string | null;
};
export type CreateSubmissionPayload = {
  title: string;
  abstract: string;
  language: string;
  cover_letter?: string;
  section: string;
  file: File;
};

export type CreateSubmissionResponse = AuthorSubmissionListItem;

export type UploadRevisedManuscriptPayload = {
  file: File;
  response_to_reviewers?: string;
};

export type UploadRevisedManuscriptResponse = SubmissionVersion;
