import { MessageSquareText, ShieldCheck } from "lucide-react";

import type { SubmissionVersion } from "@/features/submissions/types";

type AuthorReviewerFeedbackPanelProps = {
  version: SubmissionVersion;
};

export function AuthorReviewerFeedbackPanel({
  version,
}: AuthorReviewerFeedbackPanelProps) {
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <MessageSquareText
          aria-hidden="true"
          className="mt-0.5 size-5 text-blue-700"
        />

        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Reviewer feedback
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Address each comment in your response and identify where the
            manuscript was changed.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
        <ShieldCheck aria-hidden="true" className="size-4 text-blue-700" />
        Reviewer identities and confidential editor comments are not disclosed.
      </div>

      {version.reviewer_feedback.length > 0 ? (
        <div className="mt-5 space-y-4">
          {version.reviewer_feedback.map((feedback) => (
            <article
              key={feedback.reviewer_label}
              className="rounded-lg border border-blue-200 bg-white p-4"
            >
              <h3 className="text-sm font-semibold text-slate-950">
                {feedback.reviewer_label}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {feedback.comments_for_author}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-blue-300 bg-white/60 p-4 text-sm text-slate-600">
          No reviewer comments were released for this version. Follow the
          editor’s decision letter when preparing the revision.
        </p>
      )}
    </section>
  );
}
