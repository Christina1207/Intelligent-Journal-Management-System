import { PublicResourceNotFound } from "@/features/public/components/public-resource-not-found"

export default function ArticleNotFoundPage() {
  return (
    <PublicResourceNotFound
      eyebrow="Article not found"
      title="We could not find this article"
      description="The article may no longer be publicly available, or the address may be incorrect."
      actionLabel="Browse published articles"
      actionHref="/articles"
    />
  )
}
