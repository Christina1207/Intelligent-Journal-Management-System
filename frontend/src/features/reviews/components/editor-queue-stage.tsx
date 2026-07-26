import {
  CircleCheckBig,
  Clock3,
  FilePenLine,
  Gavel,
  RotateCcw,
  TriangleAlert,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  EditorReviewWorkspaceResponse,
  SectionEditorQueueSubmission,
} from "@/features/reviews/types";

export type EditorQueueStage =
  | "DECISION_REQUIRED"
  | "OVERDUE"
  | "REVISED_RETURNED"
  | "REVIEWER_SELECTION"
  | "WAITING_RESPONSES"
  | "REVIEWER_SHORTAGE"
  | "REVIEWS_IN_PROGRESS"
  | "WAITING_AUTHOR"
  | "REVIEW_SETUP";

type StagePresentation = {
  actionLabel: string;
  description: string;
  label: string;
  variant: "default" | "secondary" | "outline" | "warning" | "danger";
  icon: typeof Clock3;
};

const STAGE_PRESENTATION: Record<EditorQueueStage, StagePresentation> = {
  DECISION_REQUIRED: {
    actionLabel: "Review reports and decide",
    description: "The backend confirms that an editorial decision is allowed.",
    label: "Decision required",
    variant: "default",
    icon: Gavel,
  },
  OVERDUE: {
    actionLabel: "Resolve overdue review work",
    description: "At least one current invitation or review deadline has passed.",
    label: "Overdue or stalled",
    variant: "danger",
    icon: TriangleAlert,
  },
  REVISED_RETURNED: {
    actionLabel: "Monitor revision review",
    description:
      "A revised version is under review with current-round assignments.",
    label: "Revised manuscript returned",
    variant: "default",
    icon: RotateCcw,
  },
  REVIEWER_SELECTION: {
    actionLabel: "Select and invite reviewers",
    description:
      "The manuscript is assigned and has no current-round invitations.",
    label: "Reviewer selection required",
    variant: "warning",
    icon: UserRoundSearch,
  },
  WAITING_RESPONSES: {
    actionLabel: "Monitor invitation responses",
    description:
      "Invitations are pending and the required acceptance count is not complete.",
    label: "Waiting for responses",
    variant: "secondary",
    icon: Clock3,
  },
  REVIEWER_SHORTAGE: {
    actionLabel: "Invite an additional reviewer",
    description:
      "Accepted reviewers are below the required count with no pending responses.",
    label: "Reviewer shortage",
    variant: "warning",
    icon: UsersRound,
  },
  REVIEWS_IN_PROGRESS: {
    actionLabel: "Monitor active reviews",
    description: "Accepted reviewers are preparing current-round reports.",
    label: "Reviews in progress",
    variant: "secondary",
    icon: FilePenLine,
  },
  WAITING_AUTHOR: {
    actionLabel: "Await revised manuscript",
    description: "The author must upload the next manuscript version.",
    label: "Waiting for author revision",
    variant: "outline",
    icon: Clock3,
  },
  REVIEW_SETUP: {
    actionLabel: "Open manuscript workspace",
    description: "Open the current round to confirm the next permitted action.",
    label: "Review setup",
    variant: "outline",
    icon: CircleCheckBig,
  },
};

export function getEditorQueueStage(
  submission: SectionEditorQueueSubmission,
  workspace?: EditorReviewWorkspaceResponse,
): EditorQueueStage {
  if (workspace?.can_make_decision || submission.status === "REVIEWED") {
    return "DECISION_REQUIRED";
  }

  if ((workspace?.progress.overdue ?? 0) > 0) {
    return "OVERDUE";
  }

  if (submission.status === "UNDER_REVISION") {
    return "WAITING_AUTHOR";
  }

  const progress = workspace?.progress;

  if (!progress || !workspace?.current_version) {
    return submission.status === "ASSIGNED"
      ? "REVIEWER_SELECTION"
      : "REVIEW_SETUP";
  }

  if (progress.total_invitations === 0) {
    return "REVIEWER_SELECTION";
  }

  if (
    progress.accepted < workspace.required_reviews &&
    progress.pending > 0
  ) {
    return "WAITING_RESPONSES";
  }

  if (
    progress.accepted < workspace.required_reviews &&
    progress.pending === 0
  ) {
    return "REVIEWER_SHORTAGE";
  }

  if (
    workspace.current_version.version_number > 1 &&
    progress.accepted > progress.submitted
  ) {
    return "REVISED_RETURNED";
  }

  if (progress.submitted < progress.accepted) {
    return "REVIEWS_IN_PROGRESS";
  }

  return "REVIEW_SETUP";
}

export function getEditorQueueStagePresentation(stage: EditorQueueStage) {
  return STAGE_PRESENTATION[stage];
}

export function EditorQueueStageBadge({
  stage,
}: {
  stage: EditorQueueStage;
}) {
  const presentation = getEditorQueueStagePresentation(stage);
  const Icon = presentation.icon;

  return (
    <Badge variant={presentation.variant}>
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}
