import { PublicOpenAccessPage } from "@/features/public/pages/public-open-access-page";
import { getPublicPage } from "@/features/public/api/public-api";

export const metadata = {
  title: "Open Access",
  description: "Journal open-access policy and reader access information.",
};

export default async function OpenAccessPage() {
  const page = await getPublicPage("open-access");

  return <PublicOpenAccessPage page={page} />;
}
