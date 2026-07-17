"use client";

import { useQuery } from "@tanstack/react-query";

import { getSectionEditorQueue } from "@/features/reviews/api";
import { reviewQueryKeys } from "@/features/reviews/api/review-query-keys";

export function useSectionEditorQueue(page = 1) {
  return useQuery({
    queryKey: reviewQueryKeys.sectionEditorQueue(page),
    queryFn: () => getSectionEditorQueue(page),
  });
}
