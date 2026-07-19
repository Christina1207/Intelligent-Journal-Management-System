"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ReviewerRecommendation } from "@/features/reviews/types";

interface ReviewerRecommendationCardProps {
  reviewer: ReviewerRecommendation;
  selected: boolean;
  onSelect: (reviewer: ReviewerRecommendation) => void;
}

function percentage(score: number) {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function ReviewerRecommendationCard({
  reviewer,
  selected,
  onSelect,
}: ReviewerRecommendationCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Select ${reviewer.full_name}`}
      className={`rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
        selected
          ? "border-primary bg-primary/5"
          : "hover:border-primary hover:bg-muted/30"
      }`}
      onClick={() => onSelect(reviewer)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{reviewer.full_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reviewer.affiliation || reviewer.email}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge>{percentage(reviewer.recommendation_score)}% relevance</Badge>

          {selected ? (
            <Check className="size-4 text-primary" aria-label="Selected" />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {reviewer.scoring_mode !== "keyword_only" ? (
          <Badge variant="secondary">
            {percentage(reviewer.similarity_score)}% semantic
          </Badge>
        ) : null}

        {reviewer.scoring_mode !== "semantic_only" ? (
          <Badge variant="secondary">
            {percentage(reviewer.keyword_overlap_score)}% keyword coverage
          </Badge>
        ) : null}

        <Badge variant="outline">
          {reviewer.scoring_mode === "hybrid"
            ? "Hybrid evidence"
            : reviewer.scoring_mode === "keyword_only"
              ? "Keyword fallback"
              : "Semantic only"}
        </Badge>
        <Badge variant="outline">
          {reviewer.active_assignment_count} active
        </Badge>

        {reviewer.has_reviewed_before ? (
          <Badge variant="outline">Previous journal experience</Badge>
        ) : null}
      </div>

      {reviewer.matched_author_keywords.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            Matched author keywords
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {reviewer.matched_author_keywords.map((keyword) => (
              <Badge key={keyword} variant="outline">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {reviewer.matched_topic_keywords.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            Matched detected-topic keywords
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {reviewer.matched_topic_keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {reviewer.explanation}
      </p>

      {reviewer.biography_excerpt ? (
        <p className="mt-3 line-clamp-3 text-sm leading-5 text-muted-foreground">
          {reviewer.biography_excerpt}
        </p>
      ) : null}
    </button>
  );
}
