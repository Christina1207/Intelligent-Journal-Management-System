import { FileCheck2, MessageSquareText, Reply, ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionHeader } from "@/components/common/section-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SubmissionDecisionBadge } from "@/features/submissions/components/submission-decision-badge";
import { formatSubmissionDate } from "@/features/submissions/submission-formatters";
import type { SubmissionVersion } from "@/features/submissions/types";

type VersionHistoryProps = {
  versions: SubmissionVersion[];
};

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <section aria-labelledby="version-history-heading">
        <SectionHeader
          title="Version and decision history"
          titleId="version-history-heading"
          description="Manuscript versions and author-visible editorial records."
        />
        <EmptyState
          className="mt-4"
          icon={<FileCheck2 aria-hidden="true" />}
          title="No manuscript versions available"
          description="Version history will appear when the journal records it for this submission."
        />
      </section>
    );
  }

  const sortedVersions = [...versions].sort(
    (first, second) => second.version_number - first.version_number,
  );

  return (
    <section aria-labelledby="version-history-heading">
      <SectionHeader
        title="Version and decision history"
        titleId="version-history-heading"
        description="Each revision remains attached to the original submission record."
      />

      <ol className="mt-4 grid gap-4">
        {sortedVersions.map((version, index) => {
          const submittedDate = formatSubmissionDate(version.submitted_at);
          const decidedDate = formatSubmissionDate(version.decided_at);

          return (
            <li key={version.id}>
              <Card>
                <CardHeader className="flex-row items-start gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-sm font-semibold text-foreground">
                    {version.version_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading font-medium text-foreground">
                        Version {version.version_number}
                        {index === 0 ? " · Current" : ""}
                      </h3>
                      <SubmissionDecisionBadge decision={version.decision} />
                    </div>
                    {submittedDate ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {submittedDate}
                        {decidedDate ? ` · Decision recorded ${decidedDate}` : ""}
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary">
                    <FileAvailability
                      label="Full manuscript"
                      available={version.full_manuscript_available}
                    />
                    <FileAvailability
                      label="Blinded manuscript"
                      available={version.blinded_manuscript_available}
                    />
                  </div>

                  {version.decision_letter ? (
                    <HistoryBlock
                      icon={FileCheck2}
                      title="Decision letter"
                      content={version.decision_letter}
                    />
                  ) : null}

                  {version.reviewer_feedback.length > 0 ? (
                    <div className="rounded-lg border border-status-info-border bg-status-info-subtle p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-status-info-foreground">
                        <MessageSquareText className="size-4" aria-hidden="true" />
                        Anonymized reviewer feedback
                      </div>
                      <div className="mt-3 grid gap-3">
                        {version.reviewer_feedback.map((feedback) => (
                          <div key={feedback.reviewer_label}>
                            <p className="text-xs font-semibold text-status-info-foreground">
                              {feedback.reviewer_label}
                            </p>
                            <p
                              className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground"
                              dir="auto"
                            >
                              {feedback.comments_for_author}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                        <ShieldCheck className="size-4" aria-hidden="true" />
                        Reviewer identity and confidential editor comments are
                        excluded.
                      </p>
                    </div>
                  ) : null}

                  {version.response_to_reviewers ? (
                    <HistoryBlock
                      icon={Reply}
                      title="Your response to reviewers"
                      content={version.response_to_reviewers}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function FileAvailability({
  label,
  available,
}: {
  label: string;
  available: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <FileCheck2
        className={
          available ? "size-4 text-accent" : "size-4 text-muted-foreground"
        }
        aria-hidden="true"
      />
      {label}: {available ? "recorded" : "not recorded"}
    </span>
  );
}

function HistoryBlock({
  icon: Icon,
  title,
  content,
}: {
  icon: typeof FileCheck2;
  title: string;
  content: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/60 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="size-4 text-accent" aria-hidden="true" />
        {title}
      </p>
      <p
        className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary"
        dir="auto"
      >
        {content}
      </p>
    </div>
  );
}
