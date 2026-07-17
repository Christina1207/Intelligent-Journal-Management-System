"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, UserRoundSearch } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ReviewerInvitationForm,
  type ReviewerSelection,
} from "@/features/reviews/components/reviewer-invitation-form";
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
  const canInvite = ["ASSIGNED", "UNDER_REVIEW"].includes(submission.status);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedReviewer, setSelectedReviewer] =
    useState<ReviewerSelection | null>(null);
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
          under review. This manuscript is currently{" "}
          {submission.status.toLowerCase().replaceAll("_", " ")}.
        </AlertDescription>
      </Alert>
    );
  }

  const recommendations = recommendationsQuery.data?.recommendations ?? [];
  const candidates = candidatesQuery.data?.candidates ?? [];

  const handleAssigned = (reviewerName: string) => {
    setSelectedReviewer(null);
    setSuccessMessage(`Invitation sent successfully to ${reviewerName}.`);
  };

  return (
    <div className="space-y-6">
      {successMessage ? (
        <Alert>
          <AlertTitle>Invitation sent</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-medium">Recommended reviewers</h3>
            <p className="text-sm text-muted-foreground">
              Ranked using the manuscript topic and reviewer expertise.
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
              Manual reviewer search remains available below.
            </AlertDescription>
          </Alert>
        ) : recommendations.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No semantic recommendations are available. This can happen when
            manuscript or reviewer expertise embeddings have not been generated.
            Use manual search below.
          </p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {recommendations.map((reviewer) => (
              <button
                key={reviewer.reviewer_id}
                type="button"
                className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => {
                  setSuccessMessage(null);
                  setSelectedReviewer(recommendationSelection(reviewer));
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{reviewer.full_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reviewer.affiliation || reviewer.email}
                    </p>
                  </div>

                  <Badge variant="secondary">
                    {similarityPercentage(reviewer.similarity_score)}% match
                  </Badge>
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

                {reviewer.has_reviewed_before ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Has previously completed a review in this journal.
                  </p>
                ) : null}
              </button>
            ))}
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
              Search active reviewers by name, email, affiliation, or expertise
              keyword.
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
            placeholder="Search reviewers"
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
            No eligible reviewers match this search. Reviewers already invited
            for the current round are excluded.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {candidates.map((reviewer) => (
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
                  variant="outline"
                  onClick={() => {
                    setSuccessMessage(null);
                    setSelectedReviewer(candidateSelection(reviewer));
                  }}
                >
                  Select reviewer
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedReviewer ? (
        <>
          <Separator />

          <ReviewerInvitationForm
            key={selectedReviewer.id}
            submissionId={submission.id}
            reviewer={selectedReviewer}
            onCancel={() => setSelectedReviewer(null)}
            onAssigned={handleAssigned}
          />
        </>
      ) : null}
    </div>
  );
}
