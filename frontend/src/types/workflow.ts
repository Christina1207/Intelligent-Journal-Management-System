import type { SubmissionStatus } from "@/types/submissions"

export interface WorkflowTransition {
  from: SubmissionStatus
  to: SubmissionStatus
  label: string
}
