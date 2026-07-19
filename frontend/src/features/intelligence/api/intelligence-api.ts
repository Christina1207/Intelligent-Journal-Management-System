import type { SectionTopicAnalyticsResponse } from "@/features/intelligence/types";
import { apiClient } from "@/lib/api/client";

export function getSectionTopicAnalytics() {
  return apiClient.get<SectionTopicAnalyticsResponse>(
    "/intelligence/topics/sections/",
  );
}
