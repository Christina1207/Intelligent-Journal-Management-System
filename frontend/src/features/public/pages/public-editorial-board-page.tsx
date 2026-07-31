import type { PublicPageContent } from "../types";
import { PublicInformationPage } from "./public-information-page";

type PublicEditorialBoardPageProps = {
  page: PublicPageContent | null;
};

export function PublicEditorialBoardPage({
  page,
}: PublicEditorialBoardPageProps) {
  return (
    <PublicInformationPage
      eyebrow="Editorial Board"
      defaultTitle="Editorial Board"
      page={page}
      emptyTitle="Editorial board information not published"
      actions={[
        {
          label: "Publication Ethics",
          href: "/publication-ethics",
        },
        {
          label: "Contact the Journal",
          href: "/contact",
          variant: "secondary",
        },
      ]}
    />
  );
}
