"use client";

import { useEffect, useState } from "react";
import { Check, Search, Sparkles, UserRoundSearch, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ReviewerInvitationBatchForm,
  type ReviewerSelection,
} from "@/features/reviews/components/reviewer-invitation-batch-form";
import {
  useReviewerCandidates,
  useReviewerRecommendations,
} from "@/features/reviews/hooks";
import type {
  ReviewerCandidate,
  ReviewerRecommendation,
  SectionEditorQueueSubmission,
} from "@/features/reviews/types";

interface ReviewerDiscoveryPanelProps {
  submission: SectionEditorQueueSubmission;
}

function recommendationSelection(
  reviewer: ReviewerRecommendation,
): ReviewerSelection {
  return {
    id: reviewer.reviewer_id,
    fullName: reviewer.full_name,
    email: reviewer.email,
    affiliation: reviewer.affiliation,
    keywords: reviewer.keywords,
  };
}

function candidateSelection(reviewer: ReviewerCandidate): ReviewerSelection {
  return {
    id: reviewer.id,
    fullName: reviewer.full_name,
    email: reviewer.email,
    affiliation: reviewer.affiliation,
    keywords: reviewer.keywords,
  };
}

function similarityPercentage(score: number) {
  const normalizedScore = Math.max(0, Math.min(1, score));
  return Math.round(normalizedScore * 100);
}

export function ReviewerDiscoveryPanel({
  submission,
}: ReviewerDiscoveryPanelProps) {
  return (
    <ReviewerDiscoveryPanelContent key={submission.id} submission={submission} />
  );
}

function ReviewerDiscoveryPanelContent({
  submission,
}: ReviewerDiscoveryPanelProps) {
  const canInvite = ["ASSIGNED", "UNDER_REVIEW"].includes(submission.status);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedReviewers, setSelectedReviewers] = useState<
    ReviewerSelection[]
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const recommendationsQuery = useReviewerRecommendations(
    submission.id,
    5,
    canInvite,
  );

  const candidatesQuery = useReviewerCandidates({
    submissionId: submission.id,
    search: debouncedSearch,
    limit: 20,
    enabled: canInvite,
  });

  if (!canInvite) {
    return (
      <Alert>
        <AlertTitle>Reviewer invitations unavailable</AlertTitle>
        <AlertDescription>
          Invitations can only be created while the manuscript is assigned or
          under review.
        </AlertDescription>
      </Alert>
    );
  }

  const recommendations = recommendationsQuery.data?.recommendations ?? [];
  const candidates = candidatesQuery.data?.candidates ?? [];

  const isSelected = (reviewerId: string) =>
    selectedReviewers.some((reviewer) => reviewer.id === reviewerId);

  const toggleReviewer = (reviewer: ReviewerSelection) => {
    setSuccessMessage(null);

    setSelectedReviewers((current) => {
      const alreadySelected = current.some(
        (selected) => selected.id === reviewer.id,
      );

      if (alreadySelected) {
        return current.filter((selected) => selected.id !== reviewer.id);
      }

      return [...current, reviewer];
    });
  };

  const removeReviewer = (reviewerId: string) => {
    setSelectedReviewers((current) =>
      current.filter((reviewer) => reviewer.id !== reviewerId),
    );
  };

  const handleAssigned = (count: number) => {
    setSelectedReviewers([]);
    setSuccessMessage(
      `${count} reviewer invitation${count === 1 ? "" : "s"} sent successfully.`,
    );
  };

  return (
    <div className="space-y-6">
      {successMessage ? (
        <Alert>
          <AlertTitle>Invitations sent</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-medium">Recommended reviewers</h3>
            <p className="text-sm text-muted-foreground">
              Eligible reviewers from {submission.section.name}, ranked by
              manuscript and expertise similarity.
            </p>
          </div>
        </div>

        {recommendationsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">
            Calculating recommendations…
          </p>
        ) : recommendationsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Recommendations unavailable</AlertTitle>
            <AlertDescription>
              Manual section-scoped search remains available below.
            </AlertDescription>
          </Alert>
        ) : recommendations.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No semantic recommendations are currently available for this
            section. Use manual search below.
          </p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {recommendations.map((reviewer) => {
              const selected = isSelected(reviewer.reviewer_id);

              return (
                <button
                  key={reviewer.reviewer_id}
                  type="button"
                  aria-pressed={selected}
                  className={`rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary hover:bg-muted/30"
                  }`}
                  onClick={() =>
                    toggleReviewer(recommendationSelection(reviewer))
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{reviewer.full_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reviewer.affiliation || reviewer.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {similarityPercentage(reviewer.similarity_score)}% match
                      </Badge>

                      {selected ? (
                        <Check
                          className="size-4 text-primary"
                          aria-label="Selected"
                        />
                      ) : null}
                    </div>
                  </div>

                  {reviewer.keywords.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {reviewer.keywords.slice(0, 4).map((keyword) => (
                        <Badge key={keyword} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRoundSearch
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-medium">Search reviewer pool</h3>
            <p className="text-sm text-muted-foreground">
              Search reviewers approved for {submission.section.name}.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchInput}
            placeholder="Search by name, email, affiliation, or expertise"
            className="h-10 pl-9"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        {candidatesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">
            Loading eligible reviewers…
          </p>
        ) : candidatesQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Reviewer search unavailable</AlertTitle>
            <AlertDescription>
              The reviewer pool could not be loaded.
            </AlertDescription>
          </Alert>
        ) : candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No eligible reviewers match this search.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {candidates.map((reviewer) => {
              const selected = isSelected(reviewer.id);

              return (
                <div
                  key={reviewer.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{reviewer.full_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reviewer.email}
                      {reviewer.affiliation ? ` · ${reviewer.affiliation}` : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {reviewer.keywords.slice(0, 5).map((keyword) => (
                        <Badge key={keyword} variant="outline">
                          {keyword}
                        </Badge>
                      ))}

                      <Badge variant="secondary">
                        {reviewer.active_assignment_count} active
                      </Badge>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={selected ? "secondary" : "outline"}
                    onClick={() => toggleReviewer(candidateSelection(reviewer))}
                  >
                    {selected ? (
                      <>
                        <Check aria-hidden="true" />
                        Selected
                      </>
                    ) : (
                      "Select reviewer"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedReviewers.length > 0 ? (
        <>
          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="font-medium">
                Selected reviewers ({selectedReviewers.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Remove any reviewer before sending the invitation batch.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedReviewers.map((reviewer) => (
                <div
                  key={reviewer.id}
                  className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-1 pl-3 text-sm"
                >
                  <span>{reviewer.fullName}</span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${reviewer.fullName}`}
                    onClick={() => removeReviewer(reviewer.id)}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <ReviewerInvitationBatchForm
              submissionId={submission.id}
              reviewers={selectedReviewers}
              onCancel={() => setSelectedReviewers([])}
              onAssigned={handleAssigned}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
