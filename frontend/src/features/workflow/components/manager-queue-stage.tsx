import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { QueueTriageQueryState } from "@/features/workflow/hooks";
import type { TriageState } from "@/features/workflow/types";

export type ManagerQueueStage =
  | "AWAITING_TRIAGE"
  | "READY_FOR_ASSIGNMENT"
  | "UNAVAILABLE";

export function getManagerQueueStage(
  triage: TriageState | undefined,
): ManagerQueueStage {
  if (!triage) {
    return "UNAVAILABLE";
  }

  return triage.status === "COMPLETED" && triage.outcome === "PROCEED"
    ? "READY_FOR_ASSIGNMENT"
    : "AWAITING_TRIAGE";
}

export function getManagerQueueActionLabel(
  state: QueueTriageQueryState | undefined,
) {
  if (state?.isPending) {
    return "Open manuscript";
  }

  if (state?.isError || !state?.data) {
    return "Review workflow";
  }

  if (
    state.data.status === "COMPLETED" &&
    state.data.outcome === "PROCEED"
  ) {
    return "Assign editor";
  }

  return state.data.status === "DRAFT" ? "Continue triage" : "Begin triage";
}

export function ManagerQueueStageBadge({
  state,
}: {
  state: QueueTriageQueryState | undefined;
}) {
  if (!state || state.isPending) {
    return (
      <Badge variant="outline">
        <LoaderCircle className="animate-spin" aria-hidden="true" />
        Checking workflow
      </Badge>
    );
  }

  if (state.isError || !state.data) {
    return (
      <Badge variant="danger">
        <CircleAlert aria-hidden="true" />
        Workflow unavailable
      </Badge>
    );
  }

  if (
    state.data.status === "COMPLETED" &&
    state.data.outcome === "PROCEED"
  ) {
    return (
      <Badge variant="success">
        <CircleCheck aria-hidden="true" />
        Ready for editor
      </Badge>
    );
  }

  return (
    <Badge variant={state.data.status === "DRAFT" ? "info" : "warning"}>
      {state.data.status === "DRAFT"
        ? "Triage in progress"
        : "Triage not started"}
    </Badge>
  );
}
