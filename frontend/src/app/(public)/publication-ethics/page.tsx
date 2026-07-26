import { PublicPublicationEthicsPage } from "@/features/public/pages/public-publication-ethics-page";
import { getPublicPage } from "@/features/public/api/public-api";

export const metadata = {
  title: "Publication Ethics",
  description: "Journal publication ethics and editorial integrity policies.",
};

export default async function PublicationEthicsPage() {
  const page = await getPublicPage("publication-ethics");

  return <PublicPublicationEthicsPage page={page} />;
}
