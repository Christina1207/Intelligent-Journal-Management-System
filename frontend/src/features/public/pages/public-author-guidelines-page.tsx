import { submissionLoginHref } from "../components/public-navigation"
import type { PublicPageContent } from "../types"
import { PublicInformationPage } from "./public-information-page"

type PublicAuthorGuidelinesPageProps = {
  page: PublicPageContent | null
}

export function PublicAuthorGuidelinesPage({
  page,
}: PublicAuthorGuidelinesPageProps) {
  return (
    <PublicInformationPage
      eyebrow="Author Guidelines"
      defaultTitle="Author Guidelines"
      page={page}
      emptyTitle="Author guidelines not published"
      actions={[
        { label: "Submit Manuscript", href: submissionLoginHref },
        {
          label: "Publication Ethics",
          href: "/publication-ethics",
          variant: "secondary",
        },
      ]}
    />
  )
}
