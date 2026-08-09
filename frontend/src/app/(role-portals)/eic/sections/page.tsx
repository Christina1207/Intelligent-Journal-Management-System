import type { Metadata } from "next";

import { SectionManagementPage } from "@/features/journals/components/section-management-page";

export const metadata: Metadata = {
  title: "Section Management",
  description: "Manage journal sections and their responsible managers.",
};

export default function EditorInChiefSectionsRoute() {
  return <SectionManagementPage />;
}
