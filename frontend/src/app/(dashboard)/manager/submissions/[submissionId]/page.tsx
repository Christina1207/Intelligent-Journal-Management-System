import { TriageWorkspace } from "@/features/workflow/components/triage/triage-workspace";

export const metadata = {
  title: "Initial Manuscript Screening",
};

export default async function TriageWorkspaceRoute({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  return <TriageWorkspace submissionId={submissionId} />;
}
