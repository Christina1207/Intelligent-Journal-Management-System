import { PublicAuthorGuidelinesPage } from "@/features/public/pages/public-author-guidelines-page";
import { getPublicPage } from "@/features/public/api/public-api";

export const metadata = {
  title: "Author Guidelines",
  description: "Instructions for authors preparing manuscripts for submission.",
};

export default async function AuthorGuidelinesPage() {
  const page = await getPublicPage("author-guidelines");

  return <PublicAuthorGuidelinesPage page={page} />;
}
