import {
  isDeadlineApproaching,
  isDeadlinePast,
} from "@/features/editorial/components";
import type { ReviewerAssignment } from "@/features/reviews/types";

export type ReviewerQueueGroup =
  | "INVITATION"
  | "APPROACHING"
  | "OVERDUE"
  | "MANDATORY_REVISION"
  | "ACTIVE"
  | "COMPLETED"
  | "CLOSED";

export function isMandatoryRevisionAssignment(
  assignment: ReviewerAssignment,
) {
  return (
    assignment.status === "ACCEPTED" &&
    !assignment.review_submitted &&
    assignment.version.version_number > 1
  );
}

export function isActiveReviewOverdue(assignment: ReviewerAssignment) {
  return (
    assignment.status === "ACCEPTED" &&
    !assignment.review_submitted &&
    (assignment.is_overdue ||
      isDeadlinePast(assignment.review_deadline))
  );
}

export function getReviewerQueueGroup(
  assignment: ReviewerAssignment,
): ReviewerQueueGroup {
  if (
    assignment.status === "PENDING" &&
    assignment.can_respond &&
    !isDeadlinePast(assignment.response_deadline)
  ) {
    return "INVITATION";
  }

  if (isActiveReviewOverdue(assignment)) {
    return "OVERDUE";
  }

  if (isMandatoryRevisionAssignment(assignment)) {
    return "MANDATORY_REVISION";
  }

  if (
    assignment.status === "ACCEPTED" &&
    !assignment.review_submitted &&
    isDeadlineApproaching(assignment.review_deadline)
  ) {
    return "APPROACHING";
  }

  if (
    assignment.status === "ACCEPTED" &&
    !assignment.review_submitted
  ) {
    return "ACTIVE";
  }

  if (assignment.review_submitted) {
    return "COMPLETED";
  }

  return "CLOSED";
}

export function compareAssignmentDeadlines(
  first: ReviewerAssignment,
  second: ReviewerAssignment,
) {
  const firstDeadline =
    first.status === "PENDING"
      ? first.response_deadline
      : first.review_deadline;
  const secondDeadline =
    second.status === "PENDING"
      ? second.response_deadline
      : second.review_deadline;

  return (
    new Date(firstDeadline ?? 0).getTime() -
    new Date(secondDeadline ?? 0).getTime()
  );
}

export function compareNewestAssignments(
  first: ReviewerAssignment,
  second: ReviewerAssignment,
) {
  return (
    new Date(second.assigned_at).getTime() -
    new Date(first.assigned_at).getTime()
  );
}
