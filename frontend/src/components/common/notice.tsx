import type { ReactNode } from "react"
import {
  AlertCircle,
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  type alertVariants,
} from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>
type NoticeTone = "neutral" | "info" | "warning" | "success" | "destructive"

const tonePresentation: Record<
  NoticeTone,
  { icon: LucideIcon; variant: AlertVariant }
> = {
  neutral: { icon: AlertCircle, variant: "default" },
  info: { icon: Info, variant: "info" },
  warning: { icon: TriangleAlert, variant: "warning" },
  success: { icon: CircleCheck, variant: "success" },
  destructive: { icon: CircleX, variant: "destructive" },
}

interface NoticeProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  tone?: NoticeTone
  icon?: LucideIcon
  className?: string
}

export function Notice({
  title,
  description,
  action,
  tone = "neutral",
  icon,
  className,
}: NoticeProps) {
  const presentation = tonePresentation[tone]
  const Icon = icon ?? presentation.icon

  return (
    <Alert
      variant={presentation.variant}
      className={cn("p-4", className)}
      role={tone === "destructive" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {description || action ? (
        <AlertDescription>
          {description}
          {action ? <div className="mt-3">{action}</div> : null}
        </AlertDescription>
      ) : null}
    </Alert>
  )
}

export type { NoticeProps, NoticeTone }
