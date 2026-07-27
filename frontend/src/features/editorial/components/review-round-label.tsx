import { Badge } from "@/components/ui/badge";

type ReviewRoundLabelProps = {
  versionNumber: number;
  showVersion?: boolean;
};

export function getReviewRoundLabel(versionNumber: number) {
  return versionNumber <= 1
    ? "Initial review"
    : `Revision round ${versionNumber - 1}`;
}

export function ReviewRoundLabel({
  versionNumber,
  showVersion = true,
}: ReviewRoundLabelProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showVersion ? (
        <Badge variant="outline">Version {versionNumber}</Badge>
      ) : null}
      <Badge variant="secondary">{getReviewRoundLabel(versionNumber)}</Badge>
    </span>
  );
}
