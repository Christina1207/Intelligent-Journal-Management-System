import { PublicArchivesPage } from "@/features/public/pages/public-archives-page";
import {
  getPublicIssues,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Archives",
  description: "Browse published journal issues and archives.",
};

export default async function ArchivesPage() {
  const issues = await getPublicIssues();

  return <PublicArchivesPage issues={issues} />;
}
