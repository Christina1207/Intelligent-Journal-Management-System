import type { Metadata } from "next";

import { EditorialAnalyticsDashboard } from "@/features/intelligence/components/editorial-analytics-dashboard";

export const metadata: Metadata = {
  title: "Editor-in-Chief Overview",
  description: "Journal-wide editorial analytics and priority oversight.",
};

export default function EditorInChiefOverviewRoute() {
  return (
    <EditorialAnalyticsDashboard priorityItemBasePath="/eic/manuscripts" />
  );
}
