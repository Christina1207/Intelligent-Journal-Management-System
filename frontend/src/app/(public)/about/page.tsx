import { PublicAboutPage } from "@/features/public/pages/public-about-page";
import { getPublicPageSafe } from "@/features/public/api/public-api";

export const metadata = {
  title: "About the Journal",
  description: "Learn about the journal mission, scope, and publishing model.",
};

export default async function AboutPage() {
  const page = await getPublicPageSafe("about");

  return <PublicAboutPage page={page} />;
}
