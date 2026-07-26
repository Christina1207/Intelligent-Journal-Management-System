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
    <section
      aria-label="Submission summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {card.value}
          </p>
        </div>
      ))}
    </section>
  );
}
