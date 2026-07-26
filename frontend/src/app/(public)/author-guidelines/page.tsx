import { PublicAuthorGuidelinesPage } from "@/features/public/pages/public-author-guidelines-page";
import { getPublicPageSafe } from "@/features/public/api/public-api";

export const metadata = {
  title: "Author Guidelines",
  description: "Instructions for authors preparing manuscripts for submission.",
};

export default async function AuthorGuidelinesPage() {
  const page = await getPublicPageSafe("author-guidelines");

  return <PublicAuthorGuidelinesPage page={page} />;
}
