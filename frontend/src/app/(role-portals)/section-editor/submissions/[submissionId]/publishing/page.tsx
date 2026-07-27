import type { Metadata } from "next";

import { PublicationDraftCreationPage } from "@/features/publishing/components";

export const metadata: Metadata = {
  title: "Create Publication Draft",
};

export default async function Page({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  return <PublicationDraftCreationPage submissionId={submissionId} />;
}
