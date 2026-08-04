import type { ReactNode } from "react";

import { EditorialPortalLayout } from "@/components/layout/editorial-portal-layout";

export default function EditorInChiefLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <EditorialPortalLayout role="EDITOR_IN_CHIEF">
      {children}
    </EditorialPortalLayout>
  );
}
