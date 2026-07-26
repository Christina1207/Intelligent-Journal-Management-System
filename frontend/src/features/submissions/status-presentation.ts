import {
  CircleCheck,
  CircleX,
  FilePenLine,
  Inbox,
  MessagesSquare,
  Search,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react"

import type { SubmissionStatus } from "@/features/submissions/types"

export type SubmissionStatusTone =
  | "info"
  | "assigned"
  | "review"
  | "reviewed"
  | "action"
  | "success"
  | "danger"

export type SubmissionStatusPresentation = {
  label: string
  description: string
  tone: SubmissionStatusTone
  icon: LucideIcon
  nextStep: string
}

export const submissionStatusPresentation: Record<
  SubmissionStatus,
  SubmissionStatusPresentation
> = {
  SUBMITTED: {
    label: "Submitted",
    description:
      "The journal has received the manuscript and will begin editorial screening.",
    tone: "info",
    icon: Inbox,
    nextStep:
      "No action is required. The journal will contact you if further information is needed.",
  },
  ASSIGNED: {
    label: "Assigned to editorial handling",
    description:
      "An editor has been assigned to manage the manuscript through the editorial process.",
    tone: "assigned",
    icon: UserRoundCheck,
    nextStep:
      "No action is required while the editor completes the initial assessment.",
  },
  UNDER_REVIEW: {
    label: "Under peer review",
    description:
      "The manuscript is being evaluated through the journal's peer-review process.",
    tone: "review",
    icon: Search,
    nextStep:
      "No action is required. You will be notified when the editorial review progresses.",
  },
  REVIEWED: {
    label: "Reviews received",
    description:
      "Peer reviews have been received and the manuscript is awaiting an editorial decision.",
    tone: "reviewed",
    icon: MessagesSquare,
    nextStep:
      "No action is required until the editor communicates the decision.",
  },
  UNDER_REVISION: {
    label: "Revision requested",
    description:
      "The journal has requested changes before the manuscript can progress.",
    tone: "action",
    icon: FilePenLine,
    nextStep:
      "Review the feedback, prepare both revised manuscript files, and submit a point-by-point response.",
  },
  ACCEPTED: {
    label: "Accepted",
    description:
      "The manuscript has received a positive final editorial decision.",
    tone: "success",
    icon: CircleCheck,
    nextStep:
      "No author action is currently required. The journal will communicate the next publishing steps.",
  },
  REJECTED: {
    label: "Rejected",
    description:
      "The manuscript has received a final negative editorial decision.",
    tone: "danger",
    icon: CircleX,
    nextStep:
      "Read the decision letter for the editor's explanation and any available feedback.",
  },
}

export function getSubmissionStatusPresentation(status: SubmissionStatus) {
  return submissionStatusPresentation[status]
}
