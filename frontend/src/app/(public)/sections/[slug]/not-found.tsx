import { PublicResourceNotFound } from "@/features/public/components/public-resource-not-found"

export default function SectionNotFoundPage() {
  return (
    <PublicResourceNotFound
      eyebrow="Section not found"
      title="We could not find this journal section"
      description="The section may have been renamed, removed, or made inactive."
      actionLabel="Browse journal sections"
      actionHref="/sections"
    />
  )
}
