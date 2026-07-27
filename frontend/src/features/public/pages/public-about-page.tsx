import type { PublicPageContent } from "../types"
import { PublicInformationPage } from "./public-information-page"

type PublicAboutPageProps = {
  page: PublicPageContent | null
}

export function PublicAboutPage({ page }: PublicAboutPageProps) {
  return (
    <PublicInformationPage
      eyebrow="About the Journal"
      defaultTitle="About the Journal"
      page={page}
      emptyTitle="About information not published"
      actions={[
        { label: "Browse Articles", href: "/articles" },
        {
          label: "Author Guidelines",
          href: "/author-guidelines",
          variant: "secondary",
        },
      ]}
    />
  )
}
