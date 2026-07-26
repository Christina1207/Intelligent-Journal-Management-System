import { PublicEditorialBoardPage } from "@/features/public/pages/public-editorial-board-page";
import {
  getEditorialBoardSafe,
  getPublicJournalSafe,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Editorial Board",
  description: "View the journal editorial board and section leadership.",
};

export default async function EditorialBoardPage() {
  const [journal, members] = await Promise.all([
    getPublicJournalSafe(),
    getEditorialBoardSafe(),
  ]);

  return <PublicEditorialBoardPage journal={journal} members={members} />;
}
