import { PublicResourceNotFound } from "@/features/public/components/public-resource-not-found"

export default function IssueNotFoundPage() {
  return (
    <PublicResourceNotFound
      eyebrow="Issue not found"
      title="We could not find this journal issue"
      description="The issue may not be published, or the archive address may be incorrect."
      actionLabel="Browse issue archives"
      actionHref="/archives"
    />
  )
}
