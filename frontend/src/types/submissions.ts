export type SubmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "COPYEDITING"
  | "PUBLISHED"

export interface SubmissionSummary {
  id: string | number
  title: string
  status: SubmissionStatus
  updatedAt?: string
}
