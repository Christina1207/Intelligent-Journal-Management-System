import { Card, CardContent } from "@/components/ui/card";
import type { AuthorDashboardResponse } from "@/features/submissions/types";

type SubmissionSummaryCardsProps = {
  summary: AuthorDashboardResponse["summary"];
};

export function SubmissionSummaryCards({
  summary,
}: SubmissionSummaryCardsProps) {
  const cards = [
    { label: "Total submissions", value: summary.total },
    { label: "Active", value: summary.active },
    { label: "Needs revision", value: summary.needs_revision },
    { label: "Accepted", value: summary.accepted },
    { label: "Rejected", value: summary.rejected },
  ];

  return (
    <section aria-label="Submission summary" className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        Submission overview
      </h2>
      <Card>
        <CardContent className="grid grid-cols-2 p-0 sm:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="min-w-0 border-r border-b border-border p-4 last:border-r-0 sm:border-b-0"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {card.value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
