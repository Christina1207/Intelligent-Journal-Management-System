import type { Metadata } from "next";

import { ReviewerInvitationsPage } from "@/features/reviews/pages/reviewer-invitations-page";

export const metadata: Metadata = {
  title: "Reviewer Workspace",
};

export default function Page() {
  return <ReviewerInvitationsPage />;
}
