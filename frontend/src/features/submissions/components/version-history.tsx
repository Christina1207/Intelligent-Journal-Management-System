import type { SubmissionVersion } from "@/features/submissions/types";
import { SubmissionDecisionBadge } from "@/features/submissions/components/submission-decision-badge";

type VersionHistoryProps = {
  versions: SubmissionVersion[];
};

function formatDate(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Version history
        </h2>
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No manuscript versions are available for this submission.
        </div>
      </section>
    );
  }

  const sortedVersions = [...versions].sort(
    (a, b) => b.version_number - a.version_number,
  );

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Version history</h2>
      <p className="mt-1 text-sm text-slate-500">
        Manuscript versions and editorial decisions recorded for this
        submission.
      </p>

      <div className="mt-6 space-y-4">
        {sortedVersions.map((version) => (
          <article
            key={version.id}
            className="rounded-lg border border-slate-200 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Version {version.version_number}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted {formatDate(version.submitted_at)}
                </p>
              </div>

              <SubmissionDecisionBadge decision={version.decision} />
            </div>

            {version.decision_letter ? (
              <div className="mt-4 rounded-md bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Decision letter
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {version.decision_letter}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No decision letter has been recorded for this version yet.
              </p>
            )}

            {version.decided_at ? (
              <p className="mt-3 text-xs text-slate-500">
                Decision recorded on {formatDate(version.decided_at)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
