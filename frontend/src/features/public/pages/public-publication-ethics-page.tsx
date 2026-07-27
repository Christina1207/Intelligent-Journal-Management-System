import type { PublicPageContent } from "../types"
import { PublicInformationPage } from "./public-information-page"

type PublicPublicationEthicsPageProps = {
  page: PublicPageContent | null
}

export function PublicPublicationEthicsPage({
  page,
}: PublicPublicationEthicsPageProps) {
  return (
    <PublicInformationPage
      eyebrow="Publication Ethics"
      defaultTitle="Publication Ethics"
      page={page}
      emptyTitle="Publication ethics policy not published"
      actions={[
        { label: "Author Guidelines", href: "/author-guidelines" },
        {
          label: "Contact the Journal",
          href: "/contact",
          variant: "secondary",
        },
      ]}
    />
  )
}
