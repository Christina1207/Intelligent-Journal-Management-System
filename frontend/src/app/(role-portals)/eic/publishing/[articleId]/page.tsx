import type { Metadata } from "next";

import { PublicationRecordDetailPage } from "@/features/publishing/components";

export const metadata: Metadata = {
  title: "Publication Record",
};

export default async function EditorInChiefPublicationDetailRoute({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;

  return (
    <PublicationRecordDetailPage
      articleId={articleId}
      basePath="/eic/publishing"
      enableIssueSelection
    />
  );
}
