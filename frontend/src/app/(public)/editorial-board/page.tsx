import { getPublicPage } from "@/features/public/api/public-api";
import { PublicEditorialBoardPage } from "@/features/public/pages/public-editorial-board-page";

export const metadata = {
  title: "Editorial Board",
  description: "View the journal editorial board and section leadership.",
};

export default async function EditorialBoardPage() {
  const page = await getPublicPage("editorial-board");

  return <PublicEditorialBoardPage page={page} />;
}
