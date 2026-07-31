import type { PublicPageContent } from "../types";
import { PublicInformationPage } from "./public-information-page";

type PublicContactPageProps = {
  page: PublicPageContent | null;
};

export function PublicContactPage({ page }: PublicContactPageProps) {
  return (
    <PublicInformationPage
      eyebrow="Contact"
      defaultTitle="Contact the Journal"
      page={page}
      emptyTitle="Contact information not published"
      actions={[
        {
          label: "Browse Articles",
          href: "/articles",
        },
        {
          label: "Author Guidelines",
          href: "/author-guidelines",
          variant: "secondary",
        },
      ]}
    />
  );
}
