import { ClockAlert, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
    <Badge
      variant={content.severity === "overdue" ? "danger" : "warning"}
      title={content.description}
      className={cn(
        "h-auto min-h-6 whitespace-normal px-2.5 py-1 text-left",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {content.label}
    </Badge>
  );
}
