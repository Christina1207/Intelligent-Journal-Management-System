"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReviewerDiscoveryPanel } from "@/features/reviews/components";
import { useSectionEditorQueue } from "@/features/reviews/hooks";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";

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
      <div className="space-y-4" aria-busy="true">
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (queueQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Editorial assignments unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {queueQuery.error instanceof Error
              ? queueQuery.error.message
              : "The assignment queue could not be loaded."}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => queueQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border bg-card p-6">
        <p className="text-sm font-medium text-muted-foreground">
          Section editorial workflow
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editorial assignments
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Select an assigned manuscript, identify qualified reviewers, and
          manage the start of peer review.
        </p>
      </header>

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
                      <p className="font-medium leading-5">
                        {submission.title}
                      </p>
                      <ChevronRight
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-3">
                      <SubmissionStatusBadge status={submission.status} />
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      {submission.section.name} · Submitted{" "}
                      {formatDate(submission.submitted_at)}
                    </p>
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
                  <CardTitle>{selectedSubmission.title}</CardTitle>
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
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {selectedSubmission.abstract}
                    </p>
                  </div>

                  <ReviewerDiscoveryPanel
                    key={selectedSubmission.id}
                    submission={selectedSubmission}
                  />
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
