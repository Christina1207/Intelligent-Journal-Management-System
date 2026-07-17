import { SubmissionDetailPage } from "@/features/submissions/components/submission-detail-page";

export const metadata = {
  title: "Submission Details",
};

export default async function SubmissionDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SubmissionDetailPage submissionId={id} />;
}
