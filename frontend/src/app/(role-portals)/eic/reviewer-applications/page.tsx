import type { Metadata } from "next";

import { ReviewerApplicationManagementPage } from "@/features/reviewer-applications/pages/reviewer-application-management-page";

export const metadata: Metadata = {
  title: "Reviewer Applications",
  description: "Review reviewer applications across all journal sections.",
};

export default function EditorInChiefReviewerApplicationsRoute() {
  return <ReviewerApplicationManagementPage scope="journal" />;
}
