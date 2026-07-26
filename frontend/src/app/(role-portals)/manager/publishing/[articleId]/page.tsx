import { PublicationRecordDetailPage } from "@/features/publishing/components";

export const metadata = {
  title: "Publication Record",
};

export default async function ManagerPublicationDetailRoute({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;

  return <PublicationRecordDetailPage articleId={articleId} />;
}
