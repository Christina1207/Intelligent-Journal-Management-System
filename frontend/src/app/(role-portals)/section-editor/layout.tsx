import type { ReactNode } from "react";

import { EditorialPortalLayout } from "@/components/layout/editorial-portal-layout";

export default function SectionEditorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <EditorialPortalLayout role="SECTION_EDITOR">
      {children}
    </EditorialPortalLayout>
  );
}
