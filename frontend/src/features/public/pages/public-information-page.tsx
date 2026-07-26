import { InfoContentSection } from "../components/info-content-section"
import {
  InfoPageHero,
  type InfoPageHeroAction,
} from "../components/info-page-hero"
import type { PublicPageContent } from "../types"
import { getPublicPageSections } from "../utils/public-content"

interface PublicInformationPageProps {
  eyebrow: string
  defaultTitle: string
  page: PublicPageContent | null
  actions?: InfoPageHeroAction[]
  emptyTitle?: string
}

export function PublicInformationPage({
  eyebrow,
  defaultTitle,
  page,
  actions,
  emptyTitle,
}: PublicInformationPageProps) {
  return (
    <>
      <InfoPageHero
        eyebrow={eyebrow}
        title={page?.title || defaultTitle}
        description={page?.excerpt || undefined}
        actions={actions}
      />
      <InfoContentSection
        sections={getPublicPageSections(page)}
        emptyTitle={emptyTitle}
        emptyDescription="This content has not been published through the journal configuration API."
      />
    </>
  )
}
