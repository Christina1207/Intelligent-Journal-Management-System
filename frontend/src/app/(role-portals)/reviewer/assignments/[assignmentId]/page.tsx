import type { Metadata } from "next";

import { ReviewerAssignmentWorkspacePage } from "@/features/reviews/pages/reviewer-assignment-workspace-page";

export const metadata: Metadata = {
  title: "Review Assignment",
};

export default async function Page({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  return <ReviewerAssignmentWorkspacePage assignmentId={assignmentId} />;
}
