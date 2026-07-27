import type { PublicPageContent } from "../types"
import { PublicInformationPage } from "./public-information-page"

type PublicOpenAccessPageProps = {
  page: PublicPageContent | null
}

export function PublicOpenAccessPage({ page }: PublicOpenAccessPageProps) {
  return (
    <PublicInformationPage
      eyebrow="Open Access"
      defaultTitle="Open Access"
      page={page}
      emptyTitle="Open-access policy not published"
      actions={[
        { label: "Browse Articles", href: "/articles" },
        {
          label: "Browse Archives",
          href: "/archives",
          variant: "secondary",
        },
      ]}
    />
  )
}
