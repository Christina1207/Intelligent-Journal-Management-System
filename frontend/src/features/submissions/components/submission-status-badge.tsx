import type { SubmissionStatus } from "@/features/submissions/types";

const statusLabels: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  ASSIGNED: "Assigned to editor",
  UNDER_REVIEW: "Under review",
  SUSPENDED: "Suspended",
  REVIEWED: "Reviews completed",
  UNDER_REVISION: "Revision requested",
  REVISED: "Revision submitted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

const statusClasses: Record<SubmissionStatus, string> = {
  SUBMITTED: "border-slate-200 bg-slate-50 text-slate-700",
  ASSIGNED: "border-blue-200 bg-blue-50 text-blue-700",
  UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
  SUSPENDED: "border-amber-200 bg-amber-50 text-amber-700",
  REVIEWED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  UNDER_REVISION: "border-amber-200 bg-amber-50 text-amber-700",
  REVISED: "border-purple-200 bg-purple-50 text-purple-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

type SubmissionStatusBadgeProps = {
  status: SubmissionStatus;
};

export function SubmissionStatusBadge({ status }: SubmissionStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function getSubmissionStatusLabel(status: SubmissionStatus) {
  return statusLabels[status];
}
