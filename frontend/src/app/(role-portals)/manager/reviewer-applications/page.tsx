import type { Metadata } from "next";

import { ManagerReviewerApplicationsPage } from "@/features/reviewer-applications/pages/manager-reviewer-applications-page";

export const metadata: Metadata = {
  title: "Reviewer Applications",
  description: "Review applicants for the managed journal section.",
};

export default function ManagerReviewerApplicationsRoute() {
  return <ManagerReviewerApplicationsPage />;
}
