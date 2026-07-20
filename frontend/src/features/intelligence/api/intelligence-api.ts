import type {
  EditorialAnalyticsDashboardResponse,
  SectionTopicAnalyticsResponse,
} from "@/features/intelligence/types";
import { apiClient } from "@/lib/api/client";

export function getSectionTopicAnalytics() {
  return apiClient.get<SectionTopicAnalyticsResponse>(
    "/sections/intelligence/topics/sections/",
  );
}

export function getEditorialAnalyticsDashboard() {
  return apiClient.get<EditorialAnalyticsDashboardResponse>(
    "/sections/intelligence/editorial-dashboard/",
  );
}
