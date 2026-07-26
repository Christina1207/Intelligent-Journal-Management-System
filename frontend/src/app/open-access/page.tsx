import { PublicOpenAccessPage } from "@/features/public/pages/public-open-access-page";
import {
  getPublicJournalSafe,
  getPublicPageSafe,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Open Access",
  description: "Journal open-access policy and reader access information.",
};

export default async function OpenAccessPage() {
  const [journal, page] = await Promise.all([
    getPublicJournalSafe(),
    getPublicPageSafe("open-access"),
  ]);

  return <PublicOpenAccessPage journal={journal} page={page} />;
}
