import type { SubmissionDecision } from "@/features/submissions/types";

const decisionLabels: Record<SubmissionDecision, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  MAJOR_REVISION: "Major revision",
  MINOR_REVISION: "Minor revision",
};

const decisionClasses: Record<SubmissionDecision, string> = {
  PENDING: "border-slate-200 bg-slate-50 text-slate-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  MAJOR_REVISION: "border-orange-200 bg-orange-50 text-orange-700",
  MINOR_REVISION: "border-amber-200 bg-amber-50 text-amber-700",
};

type SubmissionDecisionBadgeProps = {
  decision: SubmissionDecision;
};

export function SubmissionDecisionBadge({
  decision,
}: SubmissionDecisionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${decisionClasses[decision]}`}
    >
      {decisionLabels[decision]}
    </span>
  );
}

export function getSubmissionDecisionLabel(decision: SubmissionDecision) {
  return decisionLabels[decision];
}
