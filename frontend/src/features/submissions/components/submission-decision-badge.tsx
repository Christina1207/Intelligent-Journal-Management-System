import {
  CircleCheck,
  CircleX,
  Clock3,
  FilePenLine,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SubmissionDecision } from "@/features/submissions/types";

const decisionPresentation: Record<
  SubmissionDecision,
  { label: string; icon: LucideIcon; className: string }
> = {
  PENDING: {
    label: "Decision pending",
    icon: Clock3,
    className: "border-border bg-surface-muted text-text-secondary",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: CircleCheck,
    className:
      "border-status-success-border bg-status-success-subtle text-status-success-foreground",
  },
  REJECTED: {
    label: "Rejected",
    icon: CircleX,
    className:
      "border-status-danger-border bg-status-danger-subtle text-status-danger-foreground",
  },
  MAJOR_REVISION: {
    label: "Major revision",
    icon: FilePenLine,
    className:
      "border-status-action-border bg-status-action-subtle text-status-action-foreground",
  },
  MINOR_REVISION: {
    label: "Minor revision",
    icon: FilePenLine,
    className:
      "border-status-action-border bg-status-action-subtle text-status-action-foreground",
  },
};

type SubmissionDecisionBadgeProps = {
  decision: SubmissionDecision;
};

export function SubmissionDecisionBadge({
  decision,
}: SubmissionDecisionBadgeProps) {
  const presentation = decisionPresentation[decision];
  const Icon = presentation.icon;

  return (
    <Badge
      variant="outline"
      className={`h-auto min-h-6 gap-1.5 rounded-md px-2 py-1 whitespace-normal ${presentation.className}`}
    >
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}

export function getSubmissionDecisionLabel(decision: SubmissionDecision) {
  return decisionPresentation[decision].label;
}
