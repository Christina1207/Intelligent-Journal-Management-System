import type { Metadata } from "next";

import { SectionEditorAssignmentsPage } from "@/features/reviews/pages/section-editor-assignments-page";

export const metadata: Metadata = {
  title: "Editorial Assignments",
};

export default function Page() {
  return <SectionEditorAssignmentsPage />;
}
