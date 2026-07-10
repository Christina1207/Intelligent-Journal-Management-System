import Link from "next/link";

import type { AuthorDashboardActionItem } from "@/features/submissions/types";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";

type ActionRequiredPanelProps = {
  items: AuthorDashboardActionItem[];
};

export function ActionRequiredPanel({ items }: ActionRequiredPanelProps) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Action required
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manuscripts that need your attention.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          You have no pending author tasks.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-slate-950">{item.title}</h3>
                  <SubmissionStatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {item.section} · Revision upload required
                </p>
              </div>

              <Link
                href={`/author/submissions/${item.id}`}
                className="inline-flex justify-center rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Upload revision
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
