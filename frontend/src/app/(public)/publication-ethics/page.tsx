import { PublicPublicationEthicsPage } from "@/features/public/pages/public-publication-ethics-page";
import { getPublicPageSafe } from "@/features/public/api/public-api";

export const metadata = {
  title: "Publication Ethics",
  description: "Journal publication ethics and editorial integrity policies.",
};

export default async function PublicationEthicsPage() {
  const page = await getPublicPageSafe("publication-ethics");

  return <PublicPublicationEthicsPage page={page} />;
}
