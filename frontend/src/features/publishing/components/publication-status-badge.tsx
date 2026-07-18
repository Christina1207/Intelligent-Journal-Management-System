import { Badge } from "@/components/ui/badge";
import type { PublicationStatus } from "@/features/publishing/types";

const STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Draft",
  published: "Published",
  retracted: "Retracted",
};

const STATUS_VARIANTS: Record<
  PublicationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  published: "default",
  retracted: "destructive",
};

export function PublicationStatusBadge({
  status,
}: {
  status: PublicationStatus;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
