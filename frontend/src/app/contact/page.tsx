import { PublicContactPage } from "@/features/public/pages/public-contact-page";
import {
  getContactMethodsSafe,
  getPublicJournalSafe,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Contact",
  description: "Contact information for the journal office.",
};

export default async function ContactPage() {
  const [journal, contacts] = await Promise.all([
    getPublicJournalSafe(),
    getContactMethodsSafe(),
  ]);

  return <PublicContactPage journal={journal} contacts={contacts} />;
}
