import { ClockAlert, TriangleAlert } from "lucide-react";

import type { ManagerAttentionFlag } from "@/features/workflow/types";
import { cn } from "@/lib/utils";

const attentionFlagContent: Record<
  ManagerAttentionFlag,
  {
    label: string;
    description: string;
    severity: "warning" | "overdue";
  }
> = {
  REVIEWER_INVITATIONS_NOT_STARTED: {
    label: "Invitations not started",
    description: "The assigned editor has not started inviting reviewers.",
    severity: "warning",
  },
  OVERDUE_REVIEWER_INVITATIONS: {
    label: "Overdue invitations",
    description:
      "One or more reviewer invitations have passed their response deadline.",
    severity: "overdue",
  },
  OVERDUE_REVIEWS: {
    label: "Overdue reviews",
    description:
      "One or more accepted reviewers have passed their review deadline.",
    severity: "overdue",
  },
  EDITOR_DECISION_PENDING: {
    label: "Editor decision pending",
    description:
      "Reviews are complete and the Section Editor should record a decision.",
    severity: "warning",
  },
  AUTHOR_REVISION_PENDING: {
    label: "Author revision pending",
    description: "The author has been asked to submit a revised manuscript.",
    severity: "warning",
  },
  REVISION_REVIEW_PENDING: {
    label: "Revision review pending",
    description:
      "A revised manuscript has been submitted and requires editorial handling.",
    severity: "warning",
  },
  CASE_SUSPENDED: {
    label: "Case suspended",
    description:
      "Editorial handling for this manuscript is currently suspended.",
    severity: "warning",
  },
};

export function AttentionFlagBadge({
  flag,
  className,
}: {
  flag: ManagerAttentionFlag;
  className?: string;
}) {
  const content = attentionFlagContent[flag];
  const Icon = content.severity === "overdue" ? ClockAlert : TriangleAlert;

  return (
    <span
      title={content.description}
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        content.severity === "overdue"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {content.label}
    </span>
  );
}
