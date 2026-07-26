import type { Metadata } from "next";

import { EditorManuscriptWorkspacePage } from "@/features/reviews/pages/editor-manuscript-workspace-page";

export const metadata: Metadata = {
  title: "Assigned Manuscript",
};

export default async function Page({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  return <EditorManuscriptWorkspacePage submissionId={submissionId} />;
}
