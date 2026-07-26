import { PublicAuthorGuidelinesPage } from "@/features/public/pages/public-author-guidelines-page";
import {
  getPublicJournalSafe,
  getPublicPageSafe,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Author Guidelines",
  description: "Instructions for authors preparing manuscripts for submission.",
};

export default async function AuthorGuidelinesPage() {
  const [journal, page] = await Promise.all([
    getPublicJournalSafe(),
    getPublicPageSafe("author-guidelines"),
  ]);

  return <PublicAuthorGuidelinesPage journal={journal} page={page} />;
}
