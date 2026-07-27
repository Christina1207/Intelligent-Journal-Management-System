import type { ReactNode } from "react";

import { EditorialPortalLayout } from "@/components/layout/editorial-portal-layout";

export default function ManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <EditorialPortalLayout role="SECTION_MANAGER">
      {children}
    </EditorialPortalLayout>
  );
}
