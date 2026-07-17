import { PublicPublicationEthicsPage } from "@/features/public/pages/public-publication-ethics-page";
import {
  getPublicJournalSafe,
  getPublicPageSafe,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Publication Ethics",
  description: "Journal publication ethics and editorial integrity policies.",
};

export default async function PublicationEthicsPage() {
  const [journal, page] = await Promise.all([
    getPublicJournalSafe(),
    getPublicPageSafe("publication-ethics"),
  ]);

  return <PublicPublicationEthicsPage journal={journal} page={page} />;
}
