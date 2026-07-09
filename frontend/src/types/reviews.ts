export type ReviewInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"

export type ReviewAssignmentStatus =
  | "INVITED"
  | "ACCEPTED"
  | "DECLINED"
  | "COMPLETED"
  | "CANCELLED"

export interface ReviewInvitationSummary {
  id: string | number
  submissionTitle: string
  status: ReviewInvitationStatus
  dueDate?: string
}
