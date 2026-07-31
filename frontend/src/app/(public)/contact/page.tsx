import { getPublicPage } from "@/features/public/api/public-api";
import { PublicContactPage } from "@/features/public/pages/public-contact-page";

export const metadata = {
  title: "Contact",
  description: "Contact information for the journal office.",
};

export default async function ContactPage() {
  const page = await getPublicPage("contact");

  return <PublicContactPage page={page} />;
}
