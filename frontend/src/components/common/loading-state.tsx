import { LoaderCircle } from "lucide-react"

interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  )
}
