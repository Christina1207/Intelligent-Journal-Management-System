import { PublicContactPage } from "@/features/public/pages/public-contact-page";
import { getContactMethodsSafe } from "@/features/public/api/public-api";

export const metadata = {
  title: "Contact",
  description: "Contact information for the journal office.",
};

export default async function ContactPage() {
  const contacts = await getContactMethodsSafe();

  return <PublicContactPage contacts={contacts} />;
}
