import { CalendarDays, Clock3, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DeadlineIndicatorProps = {
  deadline: string | null | undefined;
  isOverdue?: boolean;
  kind: "response" | "review";
  className?: string;
};

export function isDeadlinePast(deadline: string | null | undefined) {
  if (!deadline) {
    return false;
  }

  const timestamp = new Date(deadline).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

export function isDeadlineApproaching(deadline: string | null | undefined) {
  if (!deadline) {
    return false;
  }

  const remaining = new Date(deadline).getTime() - Date.now();
  return remaining >= 0 && remaining <= 48 * 60 * 60 * 1000;
}

function formatDateTime(deadline: string | null | undefined) {
  if (!deadline) {
    return "Not specified";
  }

  const date = new Date(deadline);

  if (!Number.isFinite(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function DeadlineIndicator({
  deadline,
  isOverdue = false,
  kind,
  className,
}: DeadlineIndicatorProps) {
  const deadlinePassed = isOverdue || isDeadlinePast(deadline);
  const approaching = !deadlinePassed && isDeadlineApproaching(deadline);
  const Icon = kind === "response" ? Clock3 : CalendarDays;
  const label =
    kind === "response" ? "Invitation response deadline" : "Review deadline";

  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {deadline ? (
          <time
            dateTime={deadline}
            className={cn(deadlinePassed && "font-medium text-destructive")}
          >
            {formatDateTime(deadline)}
          </time>
        ) : (
          <span>{formatDateTime(deadline)}</span>
        )}
        {deadlinePassed ? (
          <Badge variant="danger">
            <TriangleAlert aria-hidden="true" />
            Deadline passed
          </Badge>
        ) : approaching ? (
          <Badge variant="warning">Due soon</Badge>
        ) : null}
      </div>
    </div>
  );
}
