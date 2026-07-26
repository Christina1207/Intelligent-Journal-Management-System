import { PublicEditorialBoardPage } from "@/features/public/pages/public-editorial-board-page";
import { getEditorialBoard } from "@/features/public/api/public-api";

export const metadata = {
  title: "Editorial Board",
  description: "View the journal editorial board and section leadership.",
};

export default async function EditorialBoardPage() {
  const members = await getEditorialBoard();

  return <PublicEditorialBoardPage members={members} />;
}
