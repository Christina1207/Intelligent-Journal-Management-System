import { PublicEditorialBoardPage } from "@/features/public/pages/public-editorial-board-page";
import { getEditorialBoardSafe } from "@/features/public/api/public-api";

export const metadata = {
  title: "Editorial Board",
  description: "View the journal editorial board and section leadership.",
};

export default async function EditorialBoardPage() {
  const members = await getEditorialBoardSafe();

  return <PublicEditorialBoardPage members={members} />;
}
