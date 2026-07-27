export type ReviewerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReviewerApplicationListStatus = "ALL" | ReviewerApplicationStatus;

export type ReviewerApplicationApprovalPayload = {
  decision_note?: string;
};

export type ReviewerApplicationRejectionPayload = {
  decision_note: string;
};

export type ReviewerApplicationSection = {
  id: string;
  name: string;
  slug: string;
};

export type ReviewerApplicationApplicant = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  orcid: string;
  affiliation: string;
  country: string;
};

export type ReviewerApplicationDecisionUser = {
  id: string;
  full_name: string;
  email: string;
};

export type ReviewerApplication = {
  id: string;
  applicant: ReviewerApplicationApplicant;
  section: ReviewerApplicationSection;
  keywords: string[];
  biography: string;
  status: ReviewerApplicationStatus;
  decision_note: string;
  reviewed_by: ReviewerApplicationDecisionUser | null;
  submitted_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type ReviewerApplicationPayload = {
  section_id: string;
  keywords: string[];
  biography: string;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
