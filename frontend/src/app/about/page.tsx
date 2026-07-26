import { PublicAboutPage } from "@/features/public/pages/public-about-page";
import {
  getPublicJournalSafe,
  getPublicPageSafe,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "About the Journal",
  description: "Learn about the journal mission, scope, and publishing model.",
};

export default async function AboutPage() {
  const [journal, page] = await Promise.all([
    getPublicJournalSafe(),
    getPublicPageSafe("about"),
  ]);

  return <PublicAboutPage journal={journal} page={page} />;
}
