import { MessageSquareText, ShieldCheck } from "lucide-react";

import type { SubmissionVersion } from "@/features/submissions/types";

type AuthorReviewerFeedbackPanelProps = {
  version: SubmissionVersion;
};

export function AuthorReviewerFeedbackPanel({
  version,
}: AuthorReviewerFeedbackPanelProps) {
  return (
    <section className="rounded-xl border border-status-info-border bg-status-info-subtle p-5">
      <div className="flex items-start gap-3">
        <MessageSquareText
          aria-hidden="true"
          className="mt-0.5 size-5 text-status-info-foreground"
        />
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Reviewer feedback for this revision
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Address each released comment and identify where the revised
            manuscript changed.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-status-info-border bg-background/70 px-3 py-2 text-xs text-text-secondary">
        <ShieldCheck
          aria-hidden="true"
          className="size-4 text-status-info-foreground"
        />
        Reviewer identities and confidential editor comments are not disclosed.
      </div>

      {version.reviewer_feedback.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {version.reviewer_feedback.map((feedback) => (
            <article
              key={feedback.reviewer_label}
              className="rounded-lg border border-status-info-border bg-background p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {feedback.reviewer_label}
              </h3>
              <p
                className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary"
                dir="auto"
              >
                {feedback.comments_for_author}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-status-info-border bg-background/60 p-4 text-sm text-text-secondary">
          No reviewer comments were released for this version. Follow the
          editor&apos;s decision letter when preparing the revision.
        </p>
      )}
    </section>
  );
}
