import { Badge } from "@/components/ui/badge"
import {
  getSubmissionStatusPresentation,
  type SubmissionStatusTone,
} from "@/features/submissions/status-presentation"
import type { SubmissionStatus } from "@/features/submissions/types"
import { cn } from "@/lib/utils"

const toneClasses: Record<SubmissionStatusTone, string> = {
  info:
    "border-status-info-border bg-status-info-subtle text-status-info-foreground",
  assigned:
    "border-status-assigned-border bg-status-assigned-subtle text-status-assigned-foreground",
  review:
    "border-status-review-border bg-status-review-subtle text-status-review-foreground",
  reviewed:
    "border-status-reviewed-border bg-status-reviewed-subtle text-status-reviewed-foreground",
  action:
    "border-status-action-border bg-status-action-subtle text-status-action-foreground",
  success:
    "border-status-success-border bg-status-success-subtle text-status-success-foreground",
  danger:
    "border-status-danger-border bg-status-danger-subtle text-status-danger-foreground",
}

type SubmissionStatusBadgeProps = {
  status: SubmissionStatus
  className?: string
  showIcon?: boolean
}

export function SubmissionStatusBadge({
  status,
  className,
  showIcon = true,
}: SubmissionStatusBadgeProps) {
  const presentation = getSubmissionStatusPresentation(status)
  const Icon = presentation.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto min-h-6 gap-1.5 rounded-md px-2 py-1 whitespace-normal",
        toneClasses[presentation.tone],
        className
      )}
    >
      {showIcon ? <Icon aria-hidden="true" /> : null}
      <span>{presentation.label}</span>
    </Badge>
  )
}

export function getSubmissionStatusLabel(status: SubmissionStatus) {
  return getSubmissionStatusPresentation(status).label
}
