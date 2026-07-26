import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ReviewerAssignmentStatus } from "@/features/reviews/types";

const STATUS_PRESENTATION: Record<
  ReviewerAssignmentStatus,
  {
    label: string;
    variant: "default" | "outline" | "danger" | "secondary" | "warning";
  }
> = {
  PENDING: { label: "Pending response", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "default" },
  DECLINED: { label: "Declined", variant: "danger" },
  EXPIRED: { label: "Expired", variant: "outline" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

type InvitationStatusBadgeProps = {
  status: ReviewerAssignmentStatus;
  reviewSubmitted?: boolean;
  isOverdue?: boolean;
};

export function InvitationStatusBadge({
  status,
  reviewSubmitted = false,
  isOverdue = false,
}: InvitationStatusBadgeProps) {
  if (reviewSubmitted) {
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden="true" />
        Review submitted
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge variant="danger">
        {status === "PENDING" ? "Response overdue" : "Review overdue"}
      </Badge>
    );
  }

  const presentation = STATUS_PRESENTATION[status];

  return (
    <Badge variant={presentation.variant}>{presentation.label}</Badge>
  );
}
