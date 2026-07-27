import { Notice, type NoticeTone } from "@/components/common/notice"
import {
  getSubmissionStatusPresentation,
  type SubmissionStatusTone,
} from "@/features/submissions/status-presentation"
import type { SubmissionStatus } from "@/features/submissions/types"
import { cn } from "@/lib/utils"

const noticeTones: Record<SubmissionStatusTone, NoticeTone> = {
  info: "info",
  assigned: "info",
  review: "info",
  reviewed: "info",
  action: "warning",
  success: "success",
  danger: "destructive",
}

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

interface SubmissionStatusGuidanceProps {
  status: SubmissionStatus
  className?: string
}

export function SubmissionStatusGuidance({
  status,
  className,
}: SubmissionStatusGuidanceProps) {
  const presentation = getSubmissionStatusPresentation(status)

  return (
    <Notice
      title={presentation.label}
      description={
        <div className="space-y-1.5">
          <p>{presentation.description}</p>
          <p className="font-medium">Next step: {presentation.nextStep}</p>
        </div>
      }
      tone={noticeTones[presentation.tone]}
      icon={presentation.icon}
      className={cn(
        "[&_[data-slot=alert-description]]:text-current",
        toneClasses[presentation.tone],
        className
      )}
    />
  )
}
