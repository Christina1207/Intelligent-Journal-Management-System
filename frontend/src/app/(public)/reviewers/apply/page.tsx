import type { Metadata } from "next";

import { ReviewerApplicationPage } from "@/features/reviewer-applications/pages/reviewer-application-page";

export const metadata: Metadata = {
  title: "Become a Reviewer",
  description: "Apply to join the journal's approved peer-reviewer pool.",
};

export default function BecomeReviewerPage() {
  return <ReviewerApplicationPage />;
}
