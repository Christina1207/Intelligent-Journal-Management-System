"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ManuscriptSummary } from "@/features/editorial/components";
import {
  EditorReviewProgressPanel,
  ReviewerDiscoveryPanel,
} from "@/features/reviews/components";
import { useSectionEditorQueue } from "@/features/reviews/hooks";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { Separator } from "@/components/ui/separator";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function SectionEditorAssignmentsPage() {
  const [page, setPage] = useState(1);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);

  const queueQuery = useSectionEditorQueue(page);
  const submissions = useMemo(
    () => queueQuery.data?.results ?? [],
    [queueQuery.data?.results],
  );

  const selectedSubmission = useMemo(
    () =>
      submissions.find(
        (submission) => submission.id === selectedSubmissionId,
      ) ?? null,
    [selectedSubmissionId, submissions],
  );

  if (queueQuery.isPending) {
    return (
      <LoadingState
        label="Loading editorial assignments"
        className="min-h-[50vh]"
      />
    );
  }

  if (queueQuery.isError) {
    return (
      <ErrorState
        title="Editorial assignments unavailable"
        description={
          queueQuery.error instanceof Error
            ? queueQuery.error.message
            : "The assignment queue could not be loaded."
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => queueQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Section editorial workflow"
        title="Editorial assignments"
        description="Select an assigned manuscript, identify qualified reviewers, and manage the start of peer review."
      />

      {submissions.length === 0 ? (
        <EmptyState
          title="No active editorial assignments"
          description="Manuscripts assigned to you by a section manager will appear here."
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]">
          <section className="space-y-3 lg:sticky lg:top-6">
            <div>
              <h2 className="font-semibold">Assigned manuscripts</h2>
              <p className="text-sm text-muted-foreground">
                {queueQuery.data?.count ?? submissions.length} active manuscript
                {(queueQuery.data?.count ?? submissions.length) === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div className="space-y-3">
              {submissions.map((submission) => {
                const isSelected = submission.id === selectedSubmissionId;

                return (
                  <button
                    key={submission.id}
                    type="button"
                    aria-pressed={isSelected}
                    className={`w-full rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "bg-card hover:border-primary/50 hover:bg-muted/20"
                    }`}
                    onClick={() => setSelectedSubmissionId(submission.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ManuscriptSummary
                        title={submission.title}
                        metadata={
                          <>
                            {submission.section.name}
                            <span aria-hidden="true"> · </span>
                            Submitted {formatDate(submission.submitted_at)}
                          </>
                        }
                      />
                      <ChevronRight
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-3">
                      <SubmissionStatusBadge status={submission.status} />
                    </div>

                  </button>
                );
              })}
            </div>

            <nav
              aria-label="Editorial assignment pagination"
              className="flex items-center justify-between gap-3"
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!queueQuery.data?.previous}
                onClick={() => {
                  setSelectedSubmissionId(null);
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">Page {page}</span>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!queueQuery.data?.next}
                onClick={() => {
                  setSelectedSubmissionId(null);
                  setPage((current) => current + 1);
                }}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          </section>

          <section>
            {selectedSubmission ? (
              <Card>
                <CardHeader>
                  <CardTitle dir="auto">{selectedSubmission.title}</CardTitle>
                  <CardDescription>
                    {selectedSubmission.section.name} ·{" "}
                    {selectedSubmission.language.toUpperCase()}
                  </CardDescription>
                  <CardAction>
                    <SubmissionStatusBadge status={selectedSubmission.status} />
                  </CardAction>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div>
                    <h2 className="font-medium">Manuscript abstract</h2>
                    <p
                      className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
                      dir="auto"
                    >
                      {selectedSubmission.abstract}
                    </p>
                  </div>

                  <Separator />

                  <EditorReviewProgressPanel
                    submissionId={selectedSubmission.id}
                  />

                  <Separator />

                  <ReviewerDiscoveryPanel submission={selectedSubmission} />
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                title="Select an editorial assignment"
                description="Choose a manuscript from the queue to search for reviewers and create invitations."
                action={
                  <Inbox
                    className="size-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
                className="min-h-80"
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
